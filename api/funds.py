from __future__ import annotations

from itertools import combinations

from fastapi import APIRouter, Header, HTTPException

from core.database import get_db
from data.fund_data import (
    annual_cost_drag,
    compute_overlap,
    get_fund_metadata,
    is_mutual_fund,
)

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


@router.get("/{ticker}")
async def fund_metadata(ticker: str, authorization: str | None = Header(default=None)):
    """Composition + expense ratio for a fund. Curated data when available,
    yfinance fallback otherwise."""
    _get_user_id(authorization)
    meta = await get_fund_metadata(ticker)
    return {"ticker": ticker.upper(), **meta}


@router.get("/overlap/all")
async def overlap_all(authorization: str | None = Header(default=None)):
    """For the logged-in user: compute pairwise overlap between every fund
    they own. Returns only pairs >= 0.10 (10%) — anything less isn't worth
    surfacing. Sorted by overlap descending so the most striking findings
    are first."""
    user_id = _get_user_id(authorization)
    db = get_db()
    holdings_resp = (
        db.table("holdings").select("*").eq("user_id", user_id).execute()
    )
    holdings = holdings_resp.data or []

    # Only fund-like holdings. ETFs count too — they have the same overlap
    # problems with mutual funds (e.g. VTI vs VTSAX).
    fund_holdings = [
        h
        for h in holdings
        if is_mutual_fund(h.get("ticker"), h.get("asset_class"))
        or h.get("asset_class") in {"us_stocks", "intl_stocks", "bonds"}
        and (h.get("ticker") or "")[:1].isalpha()
    ]

    # Fetch metadata for each unique fund. Cap at 8 funds to keep response time
    # tight (curated lookups are instant; yfinance fallbacks are the only slow
    # path).
    by_ticker: dict[str, dict] = {}
    for h in fund_holdings[:8]:
        t = (h.get("ticker") or "").upper()
        if not t or t in by_ticker:
            continue
        meta = await get_fund_metadata(t)
        if meta.get("top_holdings"):
            by_ticker[t] = {
                "ticker": t,
                "name": meta.get("name") or h.get("name") or t,
                "value": float(h.get("current_value") or 0),
                "expense_ratio": meta.get("expense_ratio"),
                "category": meta.get("category"),
                "top_holdings": meta.get("top_holdings"),
            }

    pairs = []
    for a, b in combinations(by_ticker.values(), 2):
        overlap = compute_overlap(a["top_holdings"], b["top_holdings"])
        if overlap < 0.10:
            continue
        pairs.append(
            {
                "a": a["ticker"],
                "a_name": a["name"],
                "b": b["ticker"],
                "b_name": b["name"],
                "overlap": round(overlap, 4),
                "a_value": a["value"],
                "b_value": b["value"],
            }
        )

    pairs.sort(key=lambda p: -p["overlap"])
    return {"pairs": pairs, "fund_count": len(by_ticker)}


@router.get("/cost-drag/total")
async def cost_drag_total(authorization: str | None = Header(default=None)):
    """Annual $ drag from expense ratios across the user's portfolio.

    For each fund, drag = current_value * expense_ratio. Surfaces total
    annual fee, plus 10y projected drag (compounded against a typical 7%
    return assumption) so users understand what fees actually cost over
    their holding period.
    """
    user_id = _get_user_id(authorization)
    db = get_db()
    holdings_resp = (
        db.table("holdings").select("*").eq("user_id", user_id).execute()
    )
    holdings = holdings_resp.data or []

    items = []
    annual_total = 0.0
    for h in holdings:
        ticker = (h.get("ticker") or "").upper()
        if not ticker:
            continue
        meta = await get_fund_metadata(ticker)
        er = meta.get("expense_ratio")
        if er is None:
            continue
        value = float(h.get("current_value") or 0)
        drag = annual_cost_drag(value, er)
        if drag <= 0:
            continue
        annual_total += drag
        items.append(
            {
                "ticker": ticker,
                "name": meta.get("name") or h.get("name") or ticker,
                "expense_ratio": er,
                "current_value": value,
                "annual_drag": drag,
            }
        )

    items.sort(key=lambda x: -x["annual_drag"])

    # Naive 10-year projection: if you keep this allocation and the market
    # roughly doubles (7% annual), the fee load roughly doubles too. We
    # just project current annual_total * 10 *adjusted for growth midpoint*.
    # Math: integral over 10y of drag * (1.07)^t  ≈ drag * 14.78
    ten_year = round(annual_total * 14.78, 2)

    return {
        "annual_total": round(annual_total, 2),
        "ten_year_projected": ten_year,
        "items": items,
    }
