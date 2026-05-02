"""Mutual fund + ETF metadata: composition, expense ratio, overlap.

Mutual funds price once a day at 4pm ET (NAV) — they're not tradeable
intraday like stocks/ETFs. This module:

  • Loads a curated dataset (data/curated_funds.json) of the most-held
    401k / IRA funds — that's where 90% of everyday-investor dollars
    live. Curated data is fast and reliable; no rate-limited scraping
    on the demo path.
  • Falls back to yfinance for funds we don't have curated data for
    (best-effort; yfinance fund coverage is spotty but better than nothing).
  • Provides overlap analysis — the killer insight: most 401k investors
    own 3-5 funds that are 70%+ identical and don't realize it.
"""

from __future__ import annotations

import asyncio
import json
import re
from functools import lru_cache, partial
from pathlib import Path
from typing import Any

import yfinance as yf

from core.logger import get_logger

logger = get_logger("fund_data")

_CURATED_PATH = Path(__file__).parent / "curated_funds.json"


@lru_cache(maxsize=1)
def _load_curated() -> dict[str, dict[str, Any]]:
    try:
        with _CURATED_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("funds") or {}
    except Exception as e:
        logger.warning(f"Curated fund file unavailable: {e}")
        return {}


# ---------- detection ---------- #

# Mutual fund tickers are typically 5 alphabetical chars ending in 'X' on
# US exchanges (e.g., VTSAX, FXAIX). NOT all 5-char-X tickers are funds and
# NOT every fund matches this pattern, but combined with our curated data
# it's a reliable heuristic.
_MUTUAL_FUND_RE = re.compile(r"^[A-Z]{4,5}X$")


def is_mutual_fund(ticker: str | None, asset_class: str | None = None) -> bool:
    """Detect mutual funds. Order of evidence:
      1. Curated data flag (most reliable).
      2. asset_class hint from the user's onboarding.
      3. Ticker pattern fallback.
    """
    if not ticker:
        return False
    t = ticker.upper().strip()

    curated = _load_curated().get(t)
    if curated:
        return bool(curated.get("is_mutual_fund"))

    if asset_class in {"mutual_fund", "money_market"}:
        return True

    return bool(_MUTUAL_FUND_RE.match(t))


def is_money_market(ticker: str | None) -> bool:
    if not ticker:
        return False
    cur = _load_curated().get(ticker.upper())
    if not cur:
        return False
    return (cur.get("category") or "").lower().startswith("money market")


# ---------- metadata fetch ---------- #


def get_fund_metadata_sync(ticker: str) -> dict[str, Any]:
    """Synchronous metadata lookup. Curated first, yfinance fallback."""
    t = (ticker or "").upper().strip()
    if not t:
        return {}

    curated = _load_curated().get(t)
    if curated:
        return {**curated, "source": "curated"}

    # Fallback — yfinance tries its best for unknown funds. Returns whatever
    # it has, marks source="yfinance" so callers know it may be incomplete.
    try:
        y = yf.Ticker(t)
        info = y.info or {}
        holdings = info.get("holdings") or []
        sectors_raw = info.get("sectorWeightings") or []
        # yfinance returns sectorWeightings as [{sector: weight}, …]
        sectors: dict[str, float] = {}
        for s in sectors_raw:
            for k, v in s.items():
                if isinstance(v, (int, float)):
                    sectors[k.replace("_", " ").title()] = float(v)
        out = {
            "ticker": t,
            "name": info.get("longName") or info.get("shortName") or t,
            "fund_family": info.get("fundFamily"),
            "category": info.get("category"),
            "is_mutual_fund": (info.get("quoteType") or "").upper() == "MUTUALFUND",
            "is_index_fund": None,
            "expense_ratio": info.get("annualReportExpenseRatio"),
            "top_holdings": [
                {
                    "ticker": h.get("symbol", ""),
                    "name": h.get("holdingName", ""),
                    "weight": float(h.get("holdingPercent") or 0),
                }
                for h in holdings[:10]
            ],
            "sector_weights": sectors,
            "ytd_return": info.get("ytdReturn"),
            "three_year_return": info.get("threeYearAverageReturn"),
            "five_year_return": info.get("fiveYearAverageReturn"),
            "source": "yfinance",
        }
        return out
    except Exception as e:
        logger.warning(f"Fund metadata lookup failed for {t}: {e}")
        return {"ticker": t, "source": "unavailable", "error": str(e)}


async def get_fund_metadata(ticker: str) -> dict[str, Any]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(get_fund_metadata_sync, ticker))


# ---------- overlap analysis ---------- #


def compute_overlap(
    a_holdings: list[dict[str, Any]] | None,
    b_holdings: list[dict[str, Any]] | None,
) -> float:
    """Returns overlap as a 0-1 fraction.

    Overlap = sum(min(weight_a[t], weight_b[t])) for ticker t in both funds.
    Uses fund-symbol matching so VTSAX and VFIAX (≈identical S&P 500 exposure)
    score >0.85 even though their top-10 lists are slightly different.

    For funds that hold OTHER funds (e.g. target-date), we only get coarse
    overlap from the inner ticker; that's fine — still surfaces "you own
    target-date AND VTSAX" warnings.
    """
    if not a_holdings or not b_holdings:
        return 0.0

    a_map: dict[str, float] = {}
    for h in a_holdings:
        sym = (h.get("ticker") or "").upper()
        if not sym:
            continue
        a_map[sym] = a_map.get(sym, 0.0) + float(h.get("weight") or 0)

    overlap = 0.0
    for h in b_holdings:
        sym = (h.get("ticker") or "").upper()
        if not sym:
            continue
        w_b = float(h.get("weight") or 0)
        w_a = a_map.get(sym, 0.0)
        overlap += min(w_a, w_b)

    return min(overlap, 1.0)


def annual_cost_drag(market_value: float, expense_ratio: float | None) -> float:
    """How many $ does this expense ratio quietly remove every year?"""
    if not expense_ratio or market_value <= 0:
        return 0.0
    return round(market_value * float(expense_ratio), 2)


# ---------- top-level helper for the API ---------- #


async def get_fund_breakdown(ticker: str) -> dict[str, Any]:
    """Backwards-compat alias used by api/chat tool calls."""
    return await get_fund_metadata(ticker)
