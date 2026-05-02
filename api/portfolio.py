from fastapi import APIRouter, Header, HTTPException
from core.database import get_db
from financial.portfolio_math import portfolio_expected_return, portfolio_volatility, sharpe_ratio
from financial.rebalancing_math import calculate_current_allocation

router = APIRouter()


def _get_user_id(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    db = get_db()
    try:
        user = db.auth.get_user(token)
        return user.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/summary")
def portfolio_summary(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()

    holdings_resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
    holdings = holdings_resp.data or []
    total_value = sum(float(h.get("current_value", 0)) for h in holdings)
    allocation = calculate_current_allocation(holdings)

    goals_resp = db.table("goals").select("*").eq("user_id", user_id).execute()
    goals = goals_resp.data or []

    target_allocation = {}
    if goals:
        target_allocation = goals[0].get("target_allocation") or {}

    drift = {
        k: round(allocation.get(k, 0) - target_allocation.get(k, 0), 4)
        for k in set(list(allocation.keys()) + list(target_allocation.keys()))
    }

    return {
        "total_value": round(total_value, 2),
        "current_allocation": allocation,
        "target_allocation": target_allocation,
        "drift": drift,
        "expected_annual_return": round(portfolio_expected_return(allocation) * 100, 2),
        "portfolio_volatility": round(portfolio_volatility(allocation) * 100, 2),
        "sharpe_ratio": round(sharpe_ratio(allocation), 3),
        "holdings_count": len(holdings),
    }


@router.get("/history")
def portfolio_history(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    resp = (
        db.table("portfolio_snapshots")
        .select("total_value, allocation, snapshot_date")
        .eq("user_id", user_id)
        .order("snapshot_date", desc=False)
        .limit(365)
        .execute()
    )
    return {"history": resp.data or []}


@router.get("/allocation")
def portfolio_allocation(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()

    holdings_resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
    holdings = holdings_resp.data or []
    current = calculate_current_allocation(holdings)

    goals_resp = db.table("goals").select("target_allocation").eq("user_id", user_id).limit(1).execute()
    target = {}
    if goals_resp.data:
        target = goals_resp.data[0].get("target_allocation") or {}

    return {"current": current, "target": target}
