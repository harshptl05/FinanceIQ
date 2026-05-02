import asyncio
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from core.database import get_db
from data.market_data import get_price

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


class HoldingCreate(BaseModel):
    ticker: str
    name: str | None = None
    asset_class: str = "us_stocks"
    shares: float
    avg_cost_basis: float
    goal_id: str | None = None


class HoldingUpdate(BaseModel):
    shares: float | None = None
    avg_cost_basis: float | None = None
    asset_class: str | None = None
    goal_id: str | None = None


@router.post("")
async def create_holding(body: HoldingCreate, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()

    price = await get_price(body.ticker.upper()) or 0
    current_value = round(price * body.shares, 2)

    payload = body.model_dump()
    payload["user_id"] = user_id
    payload["ticker"] = body.ticker.upper()
    payload["current_price"] = price
    payload["current_value"] = current_value

    resp = db.table("holdings").insert(payload).execute()
    return resp.data[0] if resp.data else {}


@router.get("")
def list_holdings(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    resp = db.table("holdings").select("*").eq("user_id", user_id).execute()
    return {"holdings": resp.data or []}


@router.put("/{holding_id}")
def update_holding(holding_id: str, body: HoldingUpdate, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    resp = (
        db.table("holdings")
        .update(updates)
        .eq("id", holding_id)
        .eq("user_id", user_id)
        .execute()
    )
    return resp.data[0] if resp.data else {}


@router.delete("/{holding_id}")
def delete_holding(holding_id: str, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    db.table("holdings").delete().eq("id", holding_id).eq("user_id", user_id).execute()
    return {"deleted": holding_id}


@router.post("/sync-prices")
async def sync_prices(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    from agents.portfolio_sync import sync_user_holdings
    await sync_user_holdings(user_id)
    return {"status": "synced"}
