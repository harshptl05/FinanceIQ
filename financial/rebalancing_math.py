from datetime import datetime, date
from financial.glide_path import get_target_allocation


def check_threshold_rebalancing(
    current_allocation: dict, target_allocation: dict, threshold: float
) -> dict:
    drift = {}
    needs_rebalancing = False

    for asset_class, target_pct in target_allocation.items():
        current_pct = current_allocation.get(asset_class, 0)
        drift_amount = current_pct - target_pct
        drift[asset_class] = drift_amount
        if abs(drift_amount) > threshold:
            needs_rebalancing = True

    return {"needs_rebalancing": needs_rebalancing, "drift": drift}


def check_calendar_rebalancing(last_rebalance_date: date | None, frequency: str) -> bool:
    if last_rebalance_date is None:
        return True
    days_since = (date.today() - last_rebalance_date).days
    thresholds = {"monthly": 30, "quarterly": 90, "annually": 365}
    return days_since >= thresholds.get(frequency, 90)


def check_hybrid_rebalancing(
    last_rebalance_date: date | None,
    frequency: str,
    current_allocation: dict,
    target_allocation: dict,
    threshold: float,
) -> bool:
    calendar_triggered = check_calendar_rebalancing(last_rebalance_date, frequency)
    threshold_result = check_threshold_rebalancing(current_allocation, target_allocation, threshold)
    return calendar_triggered and threshold_result["needs_rebalancing"]


def calculate_cashflow_rebalancing(
    new_deposit: float,
    current_allocation: dict,
    target_allocation: dict,
) -> list:
    trades = []
    for asset_class, target_pct in target_allocation.items():
        current_pct = current_allocation.get(asset_class, 0)
        if current_pct < target_pct:
            amount_to_buy = new_deposit * (target_pct - current_pct)
            trades.append(
                {
                    "action": "buy",
                    "asset_class": asset_class,
                    "amount": round(amount_to_buy, 2),
                    "reason": f"Underweight by {(target_pct - current_pct) * 100:.1f}%",
                }
            )
    return trades


def calculate_rebalancing_urgency(
    drift_pct: float, years_to_goal: float, asset_volatility: float = 0.15
) -> str:
    urgency_score = (abs(drift_pct) * asset_volatility) / max(years_to_goal, 0.5)
    if urgency_score > 0.15:
        return "act_now"
    elif urgency_score > 0.08:
        return "act_soon"
    else:
        return "monitor"


def check_tax_loss_harvesting(holdings: list) -> list:
    opportunities = []
    for holding in holdings:
        cost_basis = float(holding.get("avg_cost_basis", 0)) * float(holding.get("shares", 0))
        current_value = float(holding.get("current_value", 0))
        unrealized = current_value - cost_basis
        if unrealized < -100:
            opportunities.append(
                {
                    "ticker": holding.get("ticker"),
                    "name": holding.get("name", holding.get("ticker")),
                    "unrealized_loss": unrealized,
                    "note": f"Selling {holding.get('name', holding.get('ticker'))} captures a ${abs(unrealized):.0f} tax deduction",
                }
            )
    return opportunities


def calculate_current_allocation(holdings: list) -> dict:
    total_value = sum(float(h.get("current_value", 0)) for h in holdings)
    if total_value == 0:
        return {}
    allocation: dict = {}
    for h in holdings:
        ac = h.get("asset_class", "other")
        allocation[ac] = allocation.get(ac, 0) + float(h.get("current_value", 0)) / total_value
    return allocation


def generate_recommended_trades(
    holdings: list,
    current_allocation: dict,
    target_allocation: dict,
    total_value: float,
) -> list:
    trades = []
    for asset_class, target_pct in target_allocation.items():
        current_pct = current_allocation.get(asset_class, 0)
        diff = target_pct - current_pct
        if abs(diff) < 0.01:
            continue
        dollar_amount = abs(diff) * total_value
        action = "buy" if diff > 0 else "sell"
        trades.append(
            {
                "asset_class": asset_class,
                "action": action,
                "amount": round(dollar_amount, 2),
                "reason": f"{'Under' if action == 'buy' else 'Over'}weight by {abs(diff) * 100:.1f}%",
            }
        )
    return trades


def generate_recommendation(user_data: dict, goal_id: str | None = None) -> dict:
    goals = user_data.get("goals", [])
    holdings = user_data.get("holdings", [])
    total_value = float(user_data.get("portfolio_value", 0))

    goal = None
    if goal_id:
        goal = next((g for g in goals if g["id"] == goal_id), None)
    if not goal and goals:
        goal = goals[0]

    if not goal:
        return {"error": "No goals found"}

    target_date = goal.get("target_date")
    if target_date:
        td = datetime.strptime(target_date[:10], "%Y-%m-%d").date()
        years_to_goal = max((td - date.today()).days / 365.25, 0)
    else:
        years_to_goal = 10

    goal_type = goal.get("goal_type", "other")
    target_allocation = goal.get("target_allocation") or get_target_allocation(goal_type, years_to_goal)
    current_allocation = calculate_current_allocation(holdings)
    threshold = float(goal.get("rebalancing_threshold", 0.05))
    threshold_result = check_threshold_rebalancing(current_allocation, target_allocation, threshold)

    max_drift = max((abs(v) for v in threshold_result["drift"].values()), default=0)
    urgency = calculate_rebalancing_urgency(max_drift, years_to_goal)

    trades = generate_recommended_trades(holdings, current_allocation, target_allocation, total_value)
    tlh = check_tax_loss_harvesting(holdings)

    return {
        "goal_id": goal["id"],
        "goal_name": goal.get("goal_name"),
        "needs_rebalancing": threshold_result["needs_rebalancing"],
        "current_allocation": current_allocation,
        "target_allocation": target_allocation,
        "drift": threshold_result["drift"],
        "urgency": urgency,
        "recommended_trades": trades,
        "tax_loss_harvesting": tlh,
        "years_to_goal": round(years_to_goal, 1),
    }
