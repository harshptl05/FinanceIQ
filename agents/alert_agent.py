from datetime import datetime, date
from core.database import get_db
from core.logger import get_logger

logger = get_logger("alert_agent")

_status = {"running": False, "alerts_today": 0, "error": None}
_today_date = date.today().isoformat()


def status() -> dict:
    return _status


def count_today() -> int:
    return _status["alerts_today"]


async def send_alert(news_event: dict, user_id: str, classification: dict) -> None:
    global _today_date

    today = date.today().isoformat()
    if today != _today_date:
        _today_date = today
        _status["alerts_today"] = 0

    db = get_db()
    try:
        news_event_id = None
        event_resp = db.table("news_events").select("id").eq(
            "headline", news_event["headline"]
        ).limit(1).execute()
        if event_resp.data:
            news_event_id = event_resp.data[0]["id"]

        alert = {
            "user_id": user_id,
            "news_event_id": news_event_id,
            "impact_classification": classification.get("impact", "neutral"),
            "affected_holdings": classification.get("affected_holdings", []),
            "estimated_dollar_impact": classification.get("estimated_dollar_impact", 0),
            "plain_english_explanation": classification.get("plain_english_explanation", ""),
            "action_required": classification.get("action_recommended", False),
            "urgency": classification.get("urgency", "info_only"),
            "read": False,
        }
        db.table("portfolio_alerts").insert(alert).execute()
        _status["alerts_today"] += 1
        logger.info(f"Alert sent to user {user_id}: {classification.get('plain_english_explanation', '')[:80]}")
    except Exception as e:
        _status["error"] = str(e)
        logger.error(f"AlertAgent failed for user {user_id}: {e}")


async def run() -> None:
    _status["running"] = True
    logger.info("AlertAgent started (event-driven)")
