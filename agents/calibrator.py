import asyncio
from datetime import datetime, timedelta, timezone
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


async def process_rebalance_reminders() -> None:
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    resp = (
        db.table("rebalancing_recommendations")
        .select("*")
        .eq("status", "pending")
        .lte("remind_at", now)
        .execute()
    )
    for rec in resp.data or []:
        if not rec.get("remind_at"):
            continue
        alert = {
            "user_id": rec["user_id"],
            "impact_classification": "neutral",
            "affected_holdings": [],
            "estimated_dollar_impact": None,
            "plain_english_explanation": (
                "Reminder: you asked us to nudge you about rebalancing. "
                "Your recommendation is still open — review it on the Rebalance page."
            ),
            "action_required": True,
            "urgency": "act_soon",
            "read": False,
        }
        try:
            db.table("portfolio_alerts").insert(alert).execute()
            db.table("rebalancing_recommendations").update({"remind_at": None}).eq(
                "id", rec["id"]
            ).execute()
            logger.info(
                f"Rebalance reminder for user {rec['user_id']} rec {rec['id']}"
            )
        except Exception as e:
            logger.error(
                f"process_rebalance_reminders failed for {rec.get('id')}: {e}"
            )


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
            await process_rebalance_reminders()
            _status["error"] = None
        except Exception as e:
            _status["error"] = str(e)
            logger.error(f"CalibrationAgent error: {e}")
            await asyncio.sleep(3600)
