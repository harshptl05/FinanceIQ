"""Global ticker search.

Powers the dashboard's ⌘K command palette. Two cases:

  1. The query already looks like a ticker symbol (≤6 alphanumeric chars,
     no spaces) — try `yf.Ticker(q)` directly. Fast path, ~150ms.

  2. The query is a free-text keyword like "apple" or "vanguard 500" —
     fall back to `yfinance.Search(...)` which keyword-matches against
     Yahoo's universe (covers stocks, ETFs, mutual funds, indices). It's
     a touch slower but it's how every modern broker app works.

We classify each match into one of our existing asset classes so that
the rest of the stack (live tick mode vs. NAV mode, charts, P&L) just
works without any extra plumbing on the frontend.
"""
from __future__ import annotations

import asyncio
import re
from functools import partial
from typing import Any

import requests
import yfinance as yf
from fastapi import APIRouter, Header, HTTPException

from core.logger import get_logger
from data.fund_data import is_mutual_fund

# Yahoo Finance's public search endpoint. yfinance 0.2.50 doesn't expose
# this directly, so we hit it ourselves. The User-Agent must look like
# a browser or Yahoo returns 401.
_YF_SEARCH_URL = "https://query2.finance.yahoo.com/v1/finance/search"
_YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

router = APIRouter()
logger = get_logger("search")


_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,5}$")


def _get_user_id(authorization: str | None) -> str:
    # Search is gated behind auth so we don't get scraped, even though it
    # only proxies public yfinance data.
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    from core.database import get_db

    token = authorization.split(" ", 1)[1]
    db = get_db()
    try:
        return db.auth.get_user(token).user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _classify_asset_class(quote_type: str, ticker: str, info: dict) -> str:
    """Map yfinance's quoteType (+ a few heuristics) onto our asset classes."""
    qt = (quote_type or "").lower()

    if qt == "mutualfund" or is_mutual_fund(ticker):
        # Most 401k mutual funds are equity-flavoured. Bond / money-market
        # funds get caught below by the category heuristic.
        cat = (info.get("category") or "").lower()
        if "money market" in cat or ticker.endswith("XX"):
            return "cash"
        if "bond" in cat or "fixed income" in cat:
            return "bonds"
        if "international" in cat or "world" in cat or "foreign" in cat:
            return "intl_stocks"
        return "us_stocks"

    if qt == "etf":
        cat = (info.get("category") or "").lower()
        long_name = (info.get("longName") or "").lower()
        if "bond" in cat or "bond" in long_name or "treasury" in long_name:
            return "bonds"
        if "international" in cat or "international" in long_name:
            return "intl_stocks"
        return "us_stocks"

    if qt == "currency" or qt == "cryptocurrency":
        return "other"
    if qt == "future":
        return "commodities"
    if qt == "index":
        return "us_stocks"

    # Equity (default)
    region = (info.get("region") or "").lower()
    country = (info.get("country") or "").lower()
    if region in {"us", "north america"} or country == "united states":
        return "us_stocks"
    if region or country:
        return "intl_stocks"
    return "us_stocks"


def _lookup_ticker_sync(ticker: str) -> dict[str, Any] | None:
    try:
        t = yf.Ticker(ticker)
        fast = t.fast_info
        last_price = fast.get("last_price") if hasattr(fast, "get") else getattr(fast, "last_price", None)
        if not last_price or last_price <= 0:
            return None
        # `.info` is the slower, richer call. Failures here shouldn't
        # break search — fall back to ticker-as-name.
        info: dict[str, Any] = {}
        try:
            info = t.info or {}
        except Exception:
            info = {}
        name = info.get("longName") or info.get("shortName") or ticker
        quote_type = (info.get("quoteType") or "").lower()
        previous_close = (
            fast.get("previous_close")
            if hasattr(fast, "get")
            else getattr(fast, "previous_close", None)
        )
        day_change_pct = (
            ((last_price - previous_close) / previous_close * 100.0)
            if previous_close
            else 0.0
        )
        is_fund = is_mutual_fund(ticker) or quote_type == "mutualfund"
        return {
            "ticker": ticker,
            "name": name,
            "current_price": float(last_price),
            "previous_close": float(previous_close) if previous_close else None,
            "day_change_pct": float(day_change_pct),
            "asset_class": _classify_asset_class(quote_type, ticker, info),
            "quote_type": quote_type or None,
            "is_mutual_fund": bool(is_fund),
            "currency": info.get("currency") or "USD",
            "exchange": info.get("exchange") or fast.get("exchange") if hasattr(fast, "get") else info.get("exchange"),
            "sector": info.get("sector"),
        }
    except Exception as e:
        logger.warning(f"ticker lookup failed for {ticker}: {e}")
        return None


def _keyword_search_sync(q: str, max_results: int = 8) -> list[dict[str, Any]]:
    """Hit Yahoo Finance's public search endpoint and normalise the response.

    The endpoint returns a `quotes` array of dicts shaped roughly like:
        {"symbol": "AAPL", "shortname": "Apple Inc.",
         "longname": "Apple Inc.", "quoteType": "EQUITY",
         "exchange": "NMS", ...}
    """
    try:
        resp = requests.get(
            _YF_SEARCH_URL,
            params={"q": q, "quotesCount": max_results, "newsCount": 0},
            headers=_YF_HEADERS,
            timeout=4,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning(f"keyword search failed for {q!r}: {e}")
        return []

    quotes = data.get("quotes") or []
    results: list[dict[str, Any]] = []
    for quote in quotes:
        symbol = (quote.get("symbol") or "").upper()
        if not symbol:
            continue
        # Filter out exotic types (FUTURE, CURRENCY, INDEX, OPTION) and
        # keep equity / ETF / mutual fund — the things people actually
        # buy in retail accounts.
        quote_type = (quote.get("quoteType") or "").lower()
        if quote_type and quote_type not in {"equity", "etf", "mutualfund"}:
            continue
        name = quote.get("longname") or quote.get("shortname") or symbol
        # Skip cross-listings on foreign exchanges for cleaner results
        # unless the symbol is an exact ticker match.
        exchange = (quote.get("exchange") or "").upper()
        if "." in symbol and symbol.upper() != q.upper():
            continue
        results.append(
            {
                "ticker": symbol,
                "name": name,
                "current_price": None,
                "asset_class": _classify_asset_class(quote_type, symbol, quote),
                "quote_type": quote_type or None,
                "is_mutual_fund": quote_type == "mutualfund" or is_mutual_fund(symbol),
                "exchange": exchange or None,
            }
        )
    return results


@router.get("")
async def search(
    q: str,
    authorization: str | None = Header(default=None),
):
    _get_user_id(authorization)
    q = (q or "").strip()
    if not q or len(q) > 60:
        return {"results": []}

    loop = asyncio.get_event_loop()
    results: list[dict[str, Any]] = []

    looks_like_ticker = bool(_TICKER_RE.match(q.upper()))
    if looks_like_ticker:
        match = await loop.run_in_executor(
            None, partial(_lookup_ticker_sync, q.upper())
        )
        if match:
            results.append(match)

    # Always fan out the keyword search too (covers names + cross-listings).
    keyword = await loop.run_in_executor(None, partial(_keyword_search_sync, q))
    seen = {r["ticker"] for r in results}
    for r in keyword:
        if r["ticker"] in seen:
            continue
        results.append(r)
        seen.add(r["ticker"])

    # Hydrate the top result with a live price so the UI can render the
    # first card without a second round-trip. The rest are price-on-click.
    if results and results[0].get("current_price") is None:
        hydrated = await loop.run_in_executor(
            None, partial(_lookup_ticker_sync, results[0]["ticker"])
        )
        if hydrated:
            results[0] = {**results[0], **hydrated}

    return {"results": results[:10]}


@router.get("/quote/{ticker}")
async def quote(
    ticker: str,
    authorization: str | None = Header(default=None),
):
    """Lazy-fetch a full price quote for a single ticker.

    Used by the search-result dialog the moment the user clicks a row, so
    we keep the initial keyword search lean (one yfinance hit) and only
    pay for richer data on demand.
    """
    _get_user_id(authorization)
    ticker = ticker.upper().strip()
    if not _TICKER_RE.match(ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker")
    loop = asyncio.get_event_loop()
    info = await loop.run_in_executor(None, partial(_lookup_ticker_sync, ticker))
    if not info:
        raise HTTPException(status_code=404, detail=f"No quote available for {ticker}")
    return info
