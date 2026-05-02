import math
from datetime import datetime, date

EXPECTED_RETURNS = {
    "us_stocks": 0.10,
    "intl_stocks": 0.09,
    "bonds": 0.04,
    "cash": 0.02,
    "real_estate": 0.07,
    "commodities": 0.05,
    "other": 0.06,
}

VOLATILITY = {
    "us_stocks": 0.17,
    "intl_stocks": 0.18,
    "bonds": 0.06,
    "cash": 0.01,
    "real_estate": 0.14,
    "commodities": 0.20,
    "other": 0.12,
}

CORRELATION = {
    ("us_stocks", "intl_stocks"): 0.85,
    ("us_stocks", "bonds"): -0.10,
    ("us_stocks", "cash"): 0.00,
    ("us_stocks", "real_estate"): 0.60,
    ("us_stocks", "commodities"): 0.20,
    ("intl_stocks", "bonds"): -0.05,
    ("intl_stocks", "cash"): 0.00,
    ("intl_stocks", "real_estate"): 0.55,
    ("bonds", "cash"): 0.30,
    ("bonds", "real_estate"): 0.10,
    ("bonds", "commodities"): 0.05,
    ("cash", "real_estate"): 0.05,
    ("cash", "commodities"): 0.02,
    ("real_estate", "commodities"): 0.25,
}

RISK_FREE_RATE = 0.045


def get_correlation(a: str, b: str) -> float:
    if a == b:
        return 1.0
    key = (a, b) if (a, b) in CORRELATION else (b, a)
    return CORRELATION.get(key, 0.0)


def portfolio_expected_return(allocation: dict) -> float:
    return sum(
        weight * EXPECTED_RETURNS.get(asset, 0.06)
        for asset, weight in allocation.items()
    )


def portfolio_volatility(allocation: dict) -> float:
    assets = list(allocation.keys())
    variance = 0.0
    for i, a in enumerate(assets):
        for j, b in enumerate(assets):
            w_a = allocation[a]
            w_b = allocation[b]
            vol_a = VOLATILITY.get(a, 0.12)
            vol_b = VOLATILITY.get(b, 0.12)
            corr = get_correlation(a, b)
            variance += w_a * w_b * vol_a * vol_b * corr
    return math.sqrt(max(variance, 0))


def sharpe_ratio(allocation: dict) -> float:
    ret = portfolio_expected_return(allocation)
    vol = portfolio_volatility(allocation)
    if vol == 0:
        return 0.0
    return (ret - RISK_FREE_RATE) / vol


def check_goal_progress(goal: dict, current_value: float) -> dict:
    target_amount = float(goal.get("target_amount") or 0)
    target_date_str = goal.get("target_date", "")

    try:
        target_date = datetime.strptime(target_date_str[:10], "%Y-%m-%d").date()
        years_remaining = max((target_date - date.today()).days / 365.25, 0)
    except (ValueError, TypeError):
        years_remaining = 10

    allocation = goal.get("target_allocation") or {"us_stocks": 0.6, "bonds": 0.3, "cash": 0.1}
    expected_annual_return = portfolio_expected_return(allocation)

    projected_value = current_value * ((1 + expected_annual_return) ** years_remaining)
    on_track = projected_value >= target_amount if target_amount > 0 else True
    gap = max(target_amount - projected_value, 0)

    monthly_needed = 0
    if gap > 0 and years_remaining > 0:
        r = expected_annual_return / 12
        n = years_remaining * 12
        if r > 0:
            monthly_needed = gap * r / ((1 + r) ** n - 1)
        else:
            monthly_needed = gap / n

    return {
        "goal_name": goal.get("goal_name"),
        "target_amount": target_amount,
        "current_value": current_value,
        "projected_value": round(projected_value, 2),
        "years_remaining": round(years_remaining, 1),
        "on_track": on_track,
        "shortfall": round(gap, 2),
        "monthly_contribution_needed": round(monthly_needed, 2),
        "expected_annual_return_pct": round(expected_annual_return * 100, 2),
    }
