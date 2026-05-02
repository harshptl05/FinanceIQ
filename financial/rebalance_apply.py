"""Simulate applying a target allocation to user holdings (demo / guided rebalance)."""

from __future__ import annotations

DEFAULT_TICKER_BY_CLASS: dict[str, str] = {
    "us_stocks": "VTI",
    "intl_stocks": "VXUS",
    "bonds": "BND",
    "cash": "VMFXX",
    "real_estate": "VNQ",
    "commodities": "GLD",
    "other": "VTI",
}


def _normalize_target(target_allocation: dict[str, float]) -> dict[str, float]:
    raw = {k: float(v) for k, v in target_allocation.items() if float(v) > 0}
    s = sum(raw.values())
    if s <= 0:
        return {}
    return {k: v / s for k, v in raw.items()}


def plan_rebalance_updates(
    holdings: list[dict],
    target_allocation: dict[str, float],
    goal_id: str | None = None,
) -> tuple[list[dict], list[dict]]:
    """
    Returns (updates_by_id, inserts) to align portfolio dollars with target_allocation.
    updates: { "id", "shares", "current_value", "current_price" }
    inserts: { "ticker", "asset_class", "goal_id", "shares", "avg_cost_basis", "current_price", "current_value" }
    """
    total = sum(float(h.get("current_value", 0)) for h in holdings)
    if total <= 0:
        return [], []

    target = _normalize_target(target_allocation)
    if not target:
        return [], []

    by_class: dict[str, list[dict]] = {}
    for h in holdings:
        ac = h.get("asset_class") or "other"
        by_class.setdefault(ac, []).append(h)

    desired_class_totals: dict[str, float] = {
        ac: total * pct for ac, pct in target.items()
    }

    updates: list[dict] = []
    inserts: list[dict] = []

    for ac, desired_sum in desired_class_totals.items():
        group = by_class.get(ac, [])
        class_sum = sum(float(h.get("current_value", 0)) for h in group)

        if not group:
            if desired_sum > 0.5:
                ticker = DEFAULT_TICKER_BY_CLASS.get(ac, "VTI")
                inserts.append(
                    {
                        "ticker": ticker,
                        "asset_class": ac,
                        "target_value": round(desired_sum, 2),
                        "goal_id": goal_id,
                    }
                )
            continue

        if desired_sum <= 0.01:
            for h in group:
                updates.append(
                    {
                        "id": h["id"],
                        "shares": 0.0,
                        "current_value": 0.0,
                        "current_price": float(h.get("current_price") or 0),
                    }
                )
            continue

        for h in group:
            frac = (
                float(h.get("current_value", 0)) / class_sum if class_sum > 0 else 1.0 / len(group)
            )
            new_val = desired_sum * frac
            price = float(h.get("current_price") or 0)
            old_shares = float(h.get("shares", 0))
            if price > 0:
                new_shares = new_val / price
            else:
                new_shares = old_shares
            updates.append(
                {
                    "id": h["id"],
                    "shares": round(new_shares, 6),
                    "current_value": round(new_val, 2),
                    "current_price": price if price > 0 else None,
                }
            )

    # Holdings in asset classes not in target (or zero weight): zero out
    for ac, group in by_class.items():
        if ac in desired_class_totals:
            continue
        for h in group:
            if float(h.get("current_value", 0)) <= 0:
                continue
            updates.append(
                {
                    "id": h["id"],
                    "shares": 0.0,
                    "current_value": 0.0,
                    "current_price": float(h.get("current_price") or 0),
                }
            )

    return updates, inserts


def build_strategy_rationale(goal: dict | None) -> str:
    if not goal:
        return (
            "Rebalancing brings your actual allocation back in line with your target mix — "
            "selling what drifted high and buying what drifted low."
        )
    name = goal.get("goal_name") or "your goal"
    strat = (goal.get("rebalancing_strategy") or "threshold").lower()
    freq = goal.get("rebalancing_frequency") or "quarterly"
    th = float(goal.get("rebalancing_threshold") or 0.05) * 100

    if strat == "calendar":
        return (
            f"Calendar rebalancing on your {freq} schedule fits {name}: you review on a fixed "
            "rhythm instead of reacting to every headline, which helps avoid emotional trades."
        )
    if strat == "threshold":
        return (
            f"Band (threshold) rebalancing at ±{th:.0f}% matches how you set up {name}: you only "
            "trade when drift is meaningful — controlling costs and noise while staying on track."
        )
    if strat == "hybrid":
        return (
            f"Your hybrid plan for {name} combines time-based checks with drift bands, so you "
            "rebalance when both the calendar and real misalignment say it matters."
        )
    if strat == "cashflow":
        return (
            f"Cash-flow rebalancing for {name} uses new contributions to fix drift without selling "
            "when possible — often the most tax-friendly approach in taxable accounts."
        )
    return (
        f"Staying near your target mix for {name} manages risk as markets move and keeps your "
        "timeline and goal in focus."
    )
