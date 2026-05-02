from fastapi import APIRouter, Header, HTTPException
from core.database import get_db
import agents.news_ingestion as news_agent
import agents.classifier as classification_agent

router = APIRouter()


def _get_user_id(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    db = get_db()
    try:
        return db.auth.get_user(token).user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/refresh")
async def refresh_news(authorization: str | None = Header(default=None)):
    """Manually pull one round of news and run the classifier.

    Wires news_ingestion -> classifier the same way the orchestrator does so
    that even when the worker process isn't running locally, the dashboard
    can still produce real (non-fabricated) alerts on demand.
    """
    _get_user_id(authorization)

    # Make sure the in-process callback is wired so new events flow into the
    # classifier. Idempotent — orchestrator wires the same callback.
    if news_agent._on_new_event is None:  # type: ignore[attr-defined]
        from agents.orchestrator import on_news_event, on_classified

        news_agent.set_callback(on_news_event)
        classification_agent.set_callback(on_classified)

    try:
        result = await news_agent.fetch_and_process_once(background_classify=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"News refresh failed: {e}")

    return result


@router.get("/recent")
def recent_news(
    limit: int = 20, authorization: str | None = Header(default=None)
):
    _get_user_id(authorization)
    db = get_db()
    resp = (
        db.table("news_events")
        .select("headline, source, url, published_at, processed_at")
        .order("processed_at", desc=True)
        .limit(min(limit, 100))
        .execute()
    )
    return {"news": resp.data or []}


@router.get("/status")
def news_status(authorization: str | None = Header(default=None)):
    _get_user_id(authorization)
    return {
        "news_ingestion": news_agent.status(),
        "classification": classification_agent.status(),
        "last_event_time": news_agent.last_event_time(),
    }


@router.get("/pulse")
def market_pulse(
    limit: int = 6, authorization: str | None = Header(default=None)
):
    """User-specific live news feed for the dashboard 'Market Pulse' card.

    Pulls from `portfolio_alerts` (entries the classifier wrote when it
    decided a headline materially affected THIS user's holdings) and joins
    against `news_events` to get the headline / source / url. We include
    both read and unread alerts because the card is a feed, not a notif.
    """
    user_id = _get_user_id(authorization)
    db = get_db()

    alerts_resp = (
        db.table("portfolio_alerts")
        .select(
            "id, news_event_id, impact_classification, affected_holdings,"
            " estimated_dollar_impact, plain_english_explanation, urgency,"
            " read, created_at"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(min(limit, 20))
        .execute()
    )
    alerts = alerts_resp.data or []

    # Batch-load referenced news_events so we can attach headline / source / url.
    event_ids = [a["news_event_id"] for a in alerts if a.get("news_event_id")]
    headlines: dict[str, dict] = {}
    if event_ids:
        events_resp = (
            db.table("news_events")
            .select("id, headline, source, url, published_at")
            .in_("id", event_ids)
            .execute()
        )
        headlines = {e["id"]: e for e in (events_resp.data or [])}

    items = []
    for a in alerts:
        ev = headlines.get(a.get("news_event_id") or "", {})
        items.append(
            {
                "id": a["id"],
                "impact": a.get("impact_classification") or "neutral",
                "urgency": a.get("urgency"),
                "affected_holdings": a.get("affected_holdings") or [],
                "dollar_impact": a.get("estimated_dollar_impact"),
                "explanation": a.get("plain_english_explanation"),
                "read": a.get("read", False),
                "created_at": a.get("created_at"),
                "headline": ev.get("headline"),
                "source": ev.get("source"),
                "url": ev.get("url"),
                "published_at": ev.get("published_at"),
            }
        )

    return {"pulse": items}
