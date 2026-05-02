import asyncio
from datetime import datetime, date
from core.database import get_db
from core.logger import get_logger
from data.market_data import get_price
from data.fund_data import is_mutual_fund
from financial.rebalancing_math import calculate_current_allocation, check_threshold_rebalancing
from financial.glide_path import get_target_allocation

logger = get_logger("portfolio_sync")

_status = {"running": False, "last_sync": None, "error": None}


def status() -> dict:
    return _status


async def sync_user_holdings(user_id: str) -> None:
    db = get_db()
    holdings_resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
    holdings = holdings_resp.data or []

    # Mutual funds price ONCE per day at 4pm ET. We only refresh their NAV
    # in a window after market close (4pm ET = 21:00 UTC during DST) — any
    # other time, intraday "ticking" would be fabricated and misleading.
    now = datetime.utcnow()
    in_nav_window = now.weekday() < 5 and 21 <= now.hour < 23

    for holding in holdings:
        ticker = holding.get("ticker")
        if not ticker:
            continue

        # Skip mutual funds outside the daily NAV window — preserves the
        # last known NAV instead of pretending it moved.
        is_fund = bool(holding.get("is_mutual_fund")) or is_mutual_fund(
            ticker, holding.get("asset_class")
        )
        if is_fund and not in_nav_window:
            continue

        price = await get_price(ticker)
        if price is None:
            continue
        shares = float(holding.get("shares", 0))
        current_value = round(price * shares, 2)
        update_payload: dict = {
            "current_price": price,
            "current_value": current_value,
            "last_updated": datetime.utcnow().isoformat(),
        }
        if is_fund:
            try:
                update_payload["nav_date"] = date.today().isoformat()
            except Exception:
                pass
        try:
            db.table("holdings").update(update_payload).eq("id", holding["id"]).execute()
        except Exception:
            update_payload.pop("nav_date", None)
            db.table("holdings").update(update_payload).eq("id", holding["id"]).execute()

    # Refresh after updates
    holdings_resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
    holdings = holdings_resp.data or []
    total_value = sum(float(h.get("current_value", 0)) for h in holdings)
    allocation = calculate_current_allocation(holdings)

    db.table("portfolio_snapshots").insert(
        {
            "user_id": user_id,
            "total_value": total_value,
            "allocation": allocation,
            "snapshot_date": date.today().isoformat(),
        }
    ).execute()

    # Check drift for each goal
    goals_resp = db.table("goals").select("*").eq("user_id", user_id).execute()
    for goal in (goals_resp.data or []):
        target_date = goal.get("target_date")
        if target_date:
            td = datetime.strptime(target_date[:10], "%Y-%m-%d").date()
            years = max((td - date.today()).days / 365.25, 0)
        else:
            years = 10
        target_alloc = goal.get("target_allocation") or get_target_allocation(
            goal.get("goal_type", "other"), years
        )
        threshold = float(goal.get("rebalancing_threshold", 0.05))
        result = check_threshold_rebalancing(allocation, target_alloc, threshold)
        if result["needs_rebalancing"]:
            logger.info(f"Drift detected for user {user_id} goal {goal['id']}")


async def run() -> None:
    _status["running"] = True
    logger.info("PortfolioSyncAgent started")

    while True:
        try:
            now = datetime.utcnow()
            is_market_hours = (
                now.weekday() < 5
                and 13 <= now.hour < 21
            )
            interval = 900 if is_market_hours else 3600

            db = get_db()
            profiles = db.table("user_profiles").select("id").execute()
            for profile in (profiles.data or []):
                await sync_user_holdings(profile["id"])

            _status["last_sync"] = datetime.utcnow().isoformat()
            _status["error"] = None
        except Exception as e:
            _status["error"] = str(e)
            logger.error(f"PortfolioSyncAgent error: {e}")

        await asyncio.sleep(interval if "interval" in dir() else 900)
