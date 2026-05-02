import asyncio
from datetime import datetime, timedelta
from core.database import get_db
from core.logger import get_logger

logger = get_logger("calibrator")

_status = {"running": False, "last_run": None, "error": None}


def status() -> dict:
    return _status


async def run_calibration() -> None:
    db = get_db()
    cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()

    recs_resp = (
        db.table("rebalancing_recommendations")
        .select("*")
        .eq("status", "acted")
        .lt("created_at", cutoff)
        .execute()
    )

    for rec in (recs_resp.data or []):
        existing = (
            db.table("recommendation_calibration")
            .select("id")
            .eq("recommendation_id", rec["id"])
            .execute()
        )
        if existing.data:
            continue

        snapshots = (
            db.table("portfolio_snapshots")
            .select("total_value, snapshot_date")
            .eq("user_id", rec["user_id"])
            .order("snapshot_date", desc=False)
            .execute()
        )
        snaps = snapshots.data or []

        rec_date = rec["created_at"][:10]
        snap_at_rec = next((s for s in snaps if s["snapshot_date"] >= rec_date), None)
        snap_30_later = None
        if snap_at_rec:
            target_date = (
                datetime.strptime(snap_at_rec["snapshot_date"], "%Y-%m-%d") + timedelta(days=30)
            ).strftime("%Y-%m-%d")
            snap_30_later = next((s for s in snaps if s["snapshot_date"] >= target_date), None)

        if not snap_at_rec or not snap_30_later:
            continue

        v0 = float(snap_at_rec["total_value"] or 0)
        v1 = float(snap_30_later["total_value"] or 0)
        improved = v1 > v0

        db.table("recommendation_calibration").insert(
            {
                "recommendation_id": rec["id"],
                "user_id": rec["user_id"],
                "recommended_at": rec["created_at"],
                "evaluated_at": datetime.utcnow().isoformat(),
                "portfolio_value_at_recommendation": v0,
                "portfolio_value_30_days_later": v1,
                "recommendation_was_correct": improved,
            }
        ).execute()

    _status["last_run"] = datetime.utcnow().isoformat()
    logger.info("Calibration run complete")


async def run() -> None:
    _status["running"] = True
    logger.info("CalibrationAgent started")

    while True:
        try:
            now = datetime.utcnow()
            # Run at 2am UTC daily
            next_run_seconds = (
                (24 - now.hour + 2) * 3600 - now.minute * 60 - now.second
            ) % 86400
            await asyncio.sleep(max(next_run_seconds, 60))
            await run_calibration()
            _status["error"] = None
        except Exception as e:
            _status["error"] = str(e)
            logger.error(f"CalibrationAgent error: {e}")
            await asyncio.sleep(3600)
