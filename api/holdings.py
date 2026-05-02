import asyncio
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from core.database import get_db
from data.market_data import get_price
from data.fund_data import is_mutual_fund, get_fund_metadata_sync

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

    ticker = body.ticker.upper()
    price = await get_price(ticker) or 0
    current_value = round(price * body.shares, 2)

    payload = body.model_dump()
    payload["user_id"] = user_id
    payload["ticker"] = ticker
    payload["current_price"] = price
    payload["current_value"] = current_value

    # Auto-detect mutual funds: if it looks like one or curated data flags
    # it, mark the holding accordingly so the rest of the stack can show
    # NAV-correct UI (no fake intraday ticks, expense-ratio drag, etc).
    if is_mutual_fund(ticker, body.asset_class):
        meta = get_fund_metadata_sync(ticker)
        # Only set fields the holdings table is guaranteed to accept.
        # is_mutual_fund / expense_ratio / nav_date are added by migration
        # 002 — if the migration hasn't run yet, we silently degrade rather
        # than fail user creation.
        try:
            payload["is_mutual_fund"] = True
            if meta.get("expense_ratio") is not None:
                payload["expense_ratio"] = meta["expense_ratio"]
        except Exception:
            pass

    try:
        resp = db.table("holdings").insert(payload).execute()
    except Exception:
        # Migration 002 columns may not exist on older deployments. Strip
        # the optional fields and retry once.
        for k in ("is_mutual_fund", "expense_ratio", "nav_date"):
            payload.pop(k, None)
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


# ---------------------------------------------------------------------------
# Trade endpoint
# ---------------------------------------------------------------------------
# Single endpoint that handles both buy and sell. Behaviour:
#   buy + ticker exists  -> increment shares, recalc weighted-avg cost basis
#   buy + ticker missing -> create the holding (auto-detect mutual funds)
#   sell + < shares      -> decrement shares (cost basis preserved)
#   sell + == shares     -> delete the holding row
#   sell + > shares      -> 400 (no shorting in the demo)
#
# We always price at the live last-tick from yfinance so the cost basis
# reflects what the user actually saw on screen at the moment of the trade.


class TradeBody(BaseModel):
    ticker: str
    action: Literal["buy", "sell"]
    shares: float = Field(..., gt=0)
    # Optional metadata used when creating a brand-new holding from search.
    name: str | None = None
    asset_class: str | None = None
    goal_id: str | None = None
    # If the client already has a fresh price (e.g. from the live tick
    # store), it can pass it through and skip the yfinance round-trip.
    price: float | None = None


@router.post("/trade")
async def trade(
    body: TradeBody,
    authorization: str | None = Header(default=None),
):
    user_id = _get_user_id(authorization)
    db = get_db()
    ticker = body.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    existing = (
        db.table("holdings")
        .select("*")
        .eq("user_id", user_id)
        .eq("ticker", ticker)
        .execute()
    )
    holding = (existing.data or [None])[0]

    # Price resolution order:
    #   1. Caller-supplied (the on-screen live tick) — most accurate, no
    #      network round-trip, and matches what the user just confirmed.
    #   2. yfinance live fetch — robust when not rate-limited.
    #   3. Existing holding's last current_price — keeps the trade flow
    #      usable even when external data sources are flaky (Yahoo
    #      tightens limits regularly during high-traffic windows).
    price = 0.0
    if body.price and body.price > 0:
        price = float(body.price)
    if price <= 0:
        try:
            price = float(await get_price(ticker) or 0.0)
        except Exception:
            price = 0.0
    if price <= 0 and holding:
        price = float(holding.get("current_price") or 0.0)
    if price <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not determine a current price for {ticker}. "
                "Try again in a minute or pass an explicit price."
            ),
        )

    now_iso = datetime.now(timezone.utc).isoformat()

    if body.action == "buy":
        if holding:
            old_shares = float(holding.get("shares") or 0)
            old_cost = float(holding.get("avg_cost_basis") or 0)
            new_shares = old_shares + body.shares
            new_cost = (
                ((old_shares * old_cost) + (body.shares * price)) / new_shares
                if new_shares > 0
                else price
            )
            updates = {
                "shares": new_shares,
                "avg_cost_basis": new_cost,
                "current_price": price,
                "current_value": round(new_shares * price, 2),
                "last_updated": now_iso,
            }
            resp = (
                db.table("holdings")
                .update(updates)
                .eq("id", holding["id"])
                .eq("user_id", user_id)
                .execute()
            )
            return {
                "action": "buy",
                "holding": (resp.data or [None])[0],
                "shares_traded": body.shares,
                "price": price,
                "total": round(body.shares * price, 2),
            }

        # Brand-new holding — typically arrives from the global search +
        # buy flow. Auto-detect mutual fund metadata so the rest of the
        # stack (NAV banners, expense-ratio drag, fund composition) lights
        # up the moment the trade clears.
        asset_class = body.asset_class or "us_stocks"
        payload: dict = {
            "user_id": user_id,
            "goal_id": body.goal_id,
            "ticker": ticker,
            "name": body.name or ticker,
            "asset_class": asset_class,
            "shares": body.shares,
            "avg_cost_basis": price,
            "current_price": price,
            "current_value": round(body.shares * price, 2),
            "last_updated": now_iso,
        }
        if is_mutual_fund(ticker, asset_class):
            meta = get_fund_metadata_sync(ticker)
            try:
                payload["is_mutual_fund"] = True
                if meta.get("expense_ratio") is not None:
                    payload["expense_ratio"] = meta["expense_ratio"]
            except Exception:
                pass
        try:
            resp = db.table("holdings").insert(payload).execute()
        except Exception:
            for k in ("is_mutual_fund", "expense_ratio", "nav_date"):
                payload.pop(k, None)
            resp = db.table("holdings").insert(payload).execute()
        return {
            "action": "buy",
            "holding": (resp.data or [None])[0],
            "shares_traded": body.shares,
            "price": price,
            "total": round(body.shares * price, 2),
        }

    # ---- sell ----
    if not holding:
        raise HTTPException(
            status_code=404,
            detail=f"You don't currently own {ticker}",
        )
    old_shares = float(holding.get("shares") or 0)
    if body.shares > old_shares + 1e-6:
        raise HTTPException(
            status_code=400,
            detail=f"You only own {old_shares:g} shares of {ticker}",
        )
    new_shares = max(0.0, old_shares - body.shares)

    if new_shares < 1e-6:
        # Sold the entire position — drop the row so allocation %s rebalance.
        db.table("holdings").delete().eq("id", holding["id"]).eq("user_id", user_id).execute()
        return {
            "action": "sell",
            "holding": None,
            "closed": True,
            "shares_traded": body.shares,
            "price": price,
            "total": round(body.shares * price, 2),
        }

    updates = {
        "shares": new_shares,
        "current_price": price,
        "current_value": round(new_shares * price, 2),
        "last_updated": now_iso,
    }
    resp = (
        db.table("holdings")
        .update(updates)
        .eq("id", holding["id"])
        .eq("user_id", user_id)
        .execute()
    )
    return {
        "action": "sell",
        "holding": (resp.data or [None])[0],
        "closed": False,
        "shares_traded": body.shares,
        "price": price,
        "total": round(body.shares * price, 2),
    }
