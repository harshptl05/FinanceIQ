from datetime import datetime, date
from core.database import get_db
from core.logger import get_logger
from financial.rebalancing_math import (
    calculate_current_allocation,
    check_threshold_rebalancing,
    generate_recommended_trades,
    check_tax_loss_harvesting,
    calculate_rebalancing_urgency,
)
from financial.glide_path import get_target_allocation

logger = get_logger("rebalancing_agent")

_status = {"running": False, "last_run": None, "error": None}


def status() -> dict:
    return _status


async def check_and_create_recommendation(user_id: str, goal: dict, holdings: list) -> None:
    db = get_db()

    target_date = goal.get("target_date")
    if target_date:
        td = datetime.strptime(target_date[:10], "%Y-%m-%d").date()
        years_to_goal = max((td - date.today()).days / 365.25, 0)
    else:
        years_to_goal = 10

    goal_type = goal.get("goal_type", "other")
    target_alloc = goal.get("target_allocation") or get_target_allocation(goal_type, years_to_goal)
    current_alloc = calculate_current_allocation(holdings)
    threshold = float(goal.get("rebalancing_threshold", 0.05))
    result = check_threshold_rebalancing(current_alloc, target_alloc, threshold)

    if not result["needs_rebalancing"]:
        return

    total_value = sum(float(h.get("current_value", 0)) for h in holdings)
    max_drift = max((abs(v) for v in result["drift"].values()), default=0)
    urgency = calculate_rebalancing_urgency(max_drift, years_to_goal)
    trades = generate_recommended_trades(holdings, current_alloc, target_alloc, total_value)
    tlh = check_tax_loss_harvesting(holdings)
    account_type = goal.get("account_type", "taxable")
    tax_note = None
    if account_type == "taxable" and tlh:
        tax_note = "Tax-loss harvesting opportunities detected: " + "; ".join(t["note"] for t in tlh)

    recommendation = {
        "user_id": user_id,
        "goal_id": goal["id"],
        "trigger_type": "drift",
        "trigger_description": f"Portfolio drifted past {threshold * 100:.0f}% threshold",
        "current_allocation": current_alloc,
        "target_allocation": target_alloc,
        "recommended_trades": trades,
        "urgency": urgency,
        "plain_english_explanation": (
            f"Your portfolio has drifted from its target. "
            f"The largest drift is {max_drift * 100:.1f}%. "
            f"Rebalancing can add ~0.5-1% to annual returns (Shannon's Demon)."
        ),
        "tax_loss_harvesting_opportunity": bool(tlh),
        "tax_notes": tax_note,
        "status": "pending",
    }
    db.table("rebalancing_recommendations").insert(recommendation).execute()
    logger.info(f"Rebalancing recommendation created for user {user_id} goal {goal['id']}")


async def run() -> None:
    _status["running"] = True
    logger.info("RebalancingAgent started (event-driven)")


async def process_event(news_event: dict, user_id: str, classification: dict) -> None:
    if classification.get("urgency") not in ("act_now", "act_soon"):
        return

    db = get_db()
    holdings_resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
    goals_resp = db.table("goals").select("*").eq("user_id", user_id).execute()
    holdings = holdings_resp.data or []

    for goal in (goals_resp.data or []):
        await check_and_create_recommendation(user_id, goal, holdings)
