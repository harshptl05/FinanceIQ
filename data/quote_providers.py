"""Multi-source last-price resolution.

Yahoo / yfinance is aggressively rate-limited on shared IPs (Railway,
serverless). We keep yfinance as the *fallback* but prefer vendor APIs
when keys are present:

  1. Polygon.io   — `POLYGON_API_KEY` (already used elsewhere in this repo)
  2. Finnhub      — `FINNHUB_API_KEY` (free tier ~60 req/min for equities)
  3. Alpha Vantage — `ALPHA_VANTAGE_API_KEY` (`GLOBAL_QUOTE`; 5/min free tier)
  4. yfinance     — last resort; same behaviour as before when no keys work

Search results, logos, and trading UX stay unchanged — only the numeric
quote plumbing switches sources transparently.
"""
from __future__ import annotations

from typing import Any

import requests
import yfinance as yf
from core.config import settings
from core.logger import get_logger

logger = get_logger("quote_providers")

_SESSION = requests.Session()
_SESSION.headers.update(
    {
        "User-Agent": (
            "Mozilla/5.0 (FinanceIQ; +https://github.com/harshptl05/FinanceIQ)"
        )
    }
)


def _polygon_prices(ticker: str) -> tuple[float, float | None, float] | None:
    """Return (last, previous_close, day_change_pct) or None."""
    key = (settings.polygon_api_key or "").strip()
    if not key:
        return None
    sym = ticker.upper().strip()
    url = (
        "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/"
        f"{sym}"
    )
    try:
        r = _SESSION.get(url, params={"apiKey": key}, timeout=10)
        if r.status_code != 200:
            return None
        body = r.json()
        if (body.get("status") or "").upper() == "ERROR":
            return None
        tick = body.get("ticker")
        if not isinstance(tick, dict):
            return None

        last_trade = tick.get("lastTrade") or {}
        day = tick.get("day") or {}
        prev_day = tick.get("prevDay") or {}

        p_last = None
        if isinstance(last_trade, dict):
            p_last = last_trade.get("p")

        close_day = day.get("c") if isinstance(day, dict) else None
        prev_close = prev_day.get("c") if isinstance(prev_day, dict) else None

        # Pre/post market: last trade wins; otherwise today's official close.
        last = float(p_last or close_day or 0)
        if last <= 0:
            return None

        pc = float(prev_close) if prev_close not in (None, 0) else None
        if pc and pc > 0:
            dcp = (last - pc) / pc * 100.0
        else:
            # Polygon includes today's change % when available.
            tcp = tick.get("todaysChangePerc")
            if tcp is not None:
                dcp = float(tcp)
            else:
                dcp = 0.0
        return (last, pc, dcp)
    except Exception as e:
        logger.debug(f"polygon snapshot failed for {sym}: {e}")
        return None


def _finnhub_prices(ticker: str) -> tuple[float, float | None, float] | None:
    """Finnhub quote — free tier suitable for demo dashboards."""
    key = (settings.finnhub_api_key or "").strip()
    if not key:
        return None
    sym = ticker.upper().strip()
    try:
        r = _SESSION.get(
            "https://finnhub.io/api/v1/quote",
            params={"symbol": sym, "token": key},
            timeout=8,
        )
        if r.status_code != 200:
            return None
        d = r.json()
        c = d.get("c")  # current
        pc = d.get("pc")  # previous close
        if c is None or float(c) <= 0:
            return None
        last = float(c)
        prev = float(pc) if pc not in (None, 0) else None
        if prev and prev > 0:
            dcp = (last - prev) / prev * 100.0
        else:
            dcp = float(d.get("dp") or 0)
        return (last, prev, dcp)
    except Exception as e:
        logger.debug(f"finnhub quote failed for {sym}: {e}")
        return None


def _alpha_vantage_prices(ticker: str) -> tuple[float, float | None, float] | None:
    """Alpha Vantage GLOBAL_QUOTE — 5 calls/min on free tier; use as a bridge."""
    key = (settings.alpha_vantage_api_key or "").strip()
    if not key:
        return None
    sym = ticker.upper().strip()
    try:
        r = _SESSION.get(
            "https://www.alphavantage.co/query",
            params={
                "function": "GLOBAL_QUOTE",
                "symbol": sym,
                "apikey": key,
            },
            timeout=12,
        )
        if r.status_code != 200:
            return None
        d = r.json()
        g = d.get("Global Quote") or {}
        if not g:
            return None
        last = g.get("05. price")
        prev = g.get("08. previous close")
        if not last:
            return None
        last_f = float(last)
        prev_f = float(prev) if prev else None
        if last_f <= 0:
            return None
        if prev_f and prev_f > 0:
            dcp = (last_f - prev_f) / prev_f * 100.0
        else:
            dcp = 0.0
        return (last_f, prev_f, dcp)
    except Exception as e:
        logger.debug(f"alpha vantage quote failed for {sym}: {e}")
        return None


def _yfinance_prices(ticker: str) -> tuple[float, float | None, float] | None:
    try:
        t = yf.Ticker(ticker)
        fast = t.fast_info
        last_price = (
            fast.get("last_price")
            if hasattr(fast, "get")
            else getattr(fast, "last_price", None)
        )
        if not last_price or float(last_price) <= 0:
            return None
        prev = (
            fast.get("previous_close")
            if hasattr(fast, "get")
            else getattr(fast, "previous_close", None)
        )
        prev_f = float(prev) if prev else None
        last = float(last_price)
        if prev_f and prev_f > 0:
            dcp = (last - prev_f) / prev_f * 100.0
        else:
            dcp = 0.0
        return (last, prev_f, dcp)
    except Exception as e:
        logger.warning(f"yfinance fast_info failed for {ticker}: {e}")
        return None


def resolve_prices_sync(ticker: str) -> tuple[float, float | None, float] | None:
    """Best-effort last / prev / day-change %.

    Tries Polygon → Finnhub → Alpha Vantage → yfinance. Returns None only
    if all fail.
    """
    sym = ticker.strip()
    for fn in (
        _polygon_prices,
        _finnhub_prices,
        _alpha_vantage_prices,
        _yf_prices,
    ):
        out = fn(sym)
        if out and out[0] > 0:
            return out
    return None


def _yf_prices(s: str) -> tuple[float, float | None, float] | None:
    return _yfinance_prices(s)


def enrich_info_sync(ticker: str) -> dict[str, Any]:
    """Best-effort yfinance `.info` — never raises; may be empty."""
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        return info if isinstance(info, dict) else {}
    except Exception:
        return {}
