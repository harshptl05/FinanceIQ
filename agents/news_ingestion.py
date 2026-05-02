import asyncio
from datetime import datetime
from core.database import get_db
from core.logger import get_logger
from data.news_client import fetch_rss_headlines, fetch_newsapi_headlines

logger = get_logger("news_ingestion")

_status = {"running": False, "last_event_time": None, "error": None}
_seen_hashes: set = set()

# Callback set by orchestrator
_on_new_event = None


def set_callback(fn):
    global _on_new_event
    _on_new_event = fn


def status() -> dict:
    return _status


def last_event_time() -> str | None:
    return _status["last_event_time"]


async def _load_seen_hashes() -> None:
    db = get_db()
    resp = db.table("news_events").select("headline").limit(500).order("processed_at", desc=True).execute()
    for row in (resp.data or []):
        import hashlib
        h = hashlib.md5(row["headline"].lower().strip().encode()).hexdigest()
        _seen_hashes.add(h)


async def fetch_and_process_once(*, background_classify: bool = False) -> dict:
    """Pull one round of news, insert new events, fire the on_event callback.

    Used both by the background loop and by the manual /api/news/refresh
    endpoint. When background_classify=True we schedule classification in
    a fire-and-forget task and return immediately, so the HTTP request
    doesn't block while ~20 events × N users × Anthropic latency runs.
    """
    rss = await fetch_rss_headlines()
    newsapi = await fetch_newsapi_headlines()
    all_items = rss + newsapi

    db = get_db()
    new_events = []
    for item in all_items:
        h = item.get("hash")
        if not h or h in _seen_hashes:
            continue
        _seen_hashes.add(h)

        event = {
            "headline": item["headline"],
            "source": item.get("source", ""),
            "url": item.get("url", ""),
            "published_at": item.get("published_at"),
        }
        try:
            db.table("news_events").insert(event).execute()
        except Exception as e:
            logger.warning(f"news_events insert failed: {e}")
            continue
        new_events.append(event)

    if new_events:
        _status["last_event_time"] = datetime.utcnow().isoformat()

    async def _classify_all():
        for event in new_events:
            if not _on_new_event:
                return
            try:
                await _on_new_event(event)
            except Exception as e:
                logger.error(f"on_new_event handler failed: {e}")

    if background_classify:
        # Fire-and-forget — keep a reference so it isn't GC'd mid-run.
        task = asyncio.create_task(_classify_all())
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    else:
        await _classify_all()

    return {
        "fetched": len(all_items),
        "new": len(new_events),
        "last_event_time": _status["last_event_time"],
        "classification_started_in_background": background_classify and bool(new_events),
    }


# Holds references to background classification tasks so the GC doesn't
# collect them mid-flight (Python warns about "task was destroyed but it
# is pending" otherwise).
_background_tasks: set = set()


async def run() -> None:
    _status["running"] = True
    logger.info("NewsIngestionAgent started")
    await _load_seen_hashes()

    while True:
        try:
            await fetch_and_process_once()
            _status["error"] = None
        except Exception as e:
            _status["error"] = str(e)
            logger.error(f"NewsIngestionAgent error: {e}")

        await asyncio.sleep(300)
