import asyncio
import json
from datetime import datetime
import anthropic
from core.config import settings
from core.database import get_db
from core.logger import get_logger

logger = get_logger("classifier")

# Model identifier used by the Anthropic API. Per CLAUDE.md the project
# targets Claude Sonnet 4 (claude-sonnet-4-20250514). Earlier code used
# "claude-opus-4-7" which is not a valid Anthropic model id and silently
# made every classification call fail, so the real news pipeline never
# produced alerts and only seeded demo rows showed up.
CLASSIFIER_MODEL = "claude-sonnet-4-20250514"

_status = {"running": False, "last_classified": None, "error": None}
_client: anthropic.AsyncAnthropic | None = None

_on_classified = None


def set_callback(fn):
    global _on_classified
    _on_classified = fn


def status() -> dict:
    return _status


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def classify_for_user(news_event: dict, user_id: str, holdings: list, goals: list) -> dict | None:
    if not holdings:
        return None

    portfolio_summary = {
        "user_id": user_id,
        "holdings": [
            {
                "ticker": h.get("ticker"),
                "name": h.get("name"),
                "asset_class": h.get("asset_class"),
                "current_value": h.get("current_value"),
            }
            for h in holdings
        ],
        "goals": [
            {
                "goal_type": g.get("goal_type"),
                "goal_name": g.get("goal_name"),
                "target_date": g.get("target_date"),
            }
            for g in goals
        ],
    }

    prompt = f"""You are a financial advisor analyzing news for a specific investor.

USER PORTFOLIO:
{json.dumps(portfolio_summary, indent=2)}

NEWS EVENT (the only fact you may rely on):
Headline: {news_event['headline']}
Source: {news_event.get('source', '')}
Published: {news_event.get('published_at', '')}
URL: {news_event.get('url', '')}

Analyze this news and respond with ONLY a JSON object:
{{
    "affected_holdings": ["tickers from the user's holdings list that this headline directly mentions or clearly implicates"],
    "affected_asset_classes": ["asset classes from the user's holdings that this headline directly affects"],
    "impact": "positive" | "negative" | "neutral",
    "materiality": 0.0-1.0,
    "urgency": "act_now" | "act_soon" | "monitor" | "info_only",
    "estimated_dollar_impact": 0.00,
    "plain_english_explanation": "one sentence a non-investor would understand, grounded in the headline above",
    "action_recommended": true | false,
    "action_description": "specific action in plain English or null"
}}

STRICT RULES:
- ONLY use facts from the HEADLINE / SOURCE / PUBLISHED fields above. NEVER invent
  events, dates, rate decisions, earnings numbers, or anything not in the headline.
- NEVER claim something happened "today" unless the published_at date is today.
  If you reference timing, paraphrase the actual published date.
- If the headline does not clearly relate to any of the user's holdings or asset
  classes, return: impact="neutral", materiality=0.0, affected_holdings=[],
  affected_asset_classes=[], action_recommended=false, and a plain_english_explanation
  that says the news doesn't directly affect this portfolio.
- materiality above 0.6 means the user should be alerted; below 0.3 means do nothing.
- estimated_dollar_impact must be a rough order-of-magnitude estimate using the
  user's actual position sizes; otherwise return 0.
- Plain English explanation must mention the user's specific holdings by NAME (not ticker).
- Never use financial jargon without explaining it."""

    try:
        client = _get_client()
        response = await client.messages.create(
            model=CLASSIFIER_MODEL,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        # Strip markdown code block if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        logger.error(f"Classification failed for user {user_id}: {e}")
        return None


async def classify_event(news_event: dict) -> None:
    _status["last_classified"] = datetime.utcnow().isoformat()
    db = get_db()

    profiles = db.table("user_profiles").select("id").execute()
    for profile in (profiles.data or []):
        user_id = profile["id"]
        holdings_resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
        goals_resp = db.table("goals").select("*").eq("user_id", user_id).execute()

        result = await classify_for_user(
            news_event,
            user_id,
            holdings_resp.data or [],
            goals_resp.data or [],
        )
        if (
            result
            and float(result.get("materiality", 0)) >= 0.5
            and result.get("impact") in ("positive", "negative")
            and (result.get("affected_holdings") or result.get("affected_asset_classes"))
        ):
            if _on_classified:
                await _on_classified(news_event, user_id, result)


async def run() -> None:
    _status["running"] = True
    logger.info("ClassificationAgent started (event-driven, no loop needed)")
