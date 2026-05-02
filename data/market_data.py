import asyncio
from functools import partial
import yfinance as yf
from core.logger import get_logger
from data.quote_providers import resolve_prices_sync

logger = get_logger("market_data")

# Money-market / stable NAV mutual funds: Yahoo and many quote APIs omit a
# tradeable "last" for these symbols, but every share is worth $1.00 for
# portfolio math (shares = dollars). Rebalance inserts VMFXX when building
# cash sleeves — without this pin, apply_rebalanced_allocation raises
# "Could not price VMFXX".
_NAV_ONE_USD_TICKERS: frozenset[str] = frozenset(
    {
        "VMFXX",  # Vanguard Federal Money Market Investor
        "VMMXX",  # Vanguard Treasury Money Market Investor
        "VUSXX",  # Vanguard Treasury Money Market Admiral
        "VPTXX",  # Vanguard Pennsylvania Tax-Exempt Money Market
        "SPAXX",  # Fidelity Government Money Market
        "FDRXX",  # Fidelity Government Cash Reserves
        "FZCXX",  # Fidelity Government Money Market
        "SWVXX",  # Schwab Value Advantage Money Investor
    }
)


def _fetch_stock_info_sync(ticker: str) -> dict:
    try:
        sym = (ticker or "").upper().strip()
        if sym in _NAV_ONE_USD_TICKERS:
            return {
                "ticker": sym,
                "name": sym,
                "price": 1.0,
                "previous_close": 1.0,
                "day_change_pct": 0.0,
                "market_cap": None,
                "sector": None,
                "industry": None,
                "fifty_two_week_high": 1.0,
                "fifty_two_week_low": 1.0,
                "currency": "USD",
            }

        px = resolve_prices_sync(sym)
        last_price = px[0] if px else None
        previous_close = px[1] if px else None
        day_change_pct = px[2] if px else 0.0

        t = yf.Ticker(sym)
        info = t.info or {}
        fast = t.fast_info

        # If alternate APIs failed, fall back to Yahoo-only fields.
        if not last_price or last_price <= 0:
            if hasattr(fast, "get"):
                last_price = fast.get("last_price")
                previous_close = fast.get("previous_close")
            else:
                last_price = getattr(fast, "last_price", None)
                previous_close = getattr(fast, "previous_close", None)
            if last_price and previous_close:
                day_change_pct = (
                    (last_price - previous_close) / previous_close * 100
                )
            else:
                day_change_pct = 0

        if hasattr(fast, "get"):
            fh = fast.get("fifty_two_week_high")
            fl = fast.get("fifty_two_week_low")
        else:
            fh = getattr(fast, "fifty_two_week_high", None)
            fl = getattr(fast, "fifty_two_week_low", None)

        return {
            "ticker": sym,
            "name": info.get("longName", sym),
            "price": last_price,
            "previous_close": previous_close,
            "day_change_pct": day_change_pct,
            "market_cap": info.get("marketCap"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "fifty_two_week_high": fh,
            "fifty_two_week_low": fl,
            "currency": info.get("currency", "USD"),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch info for {ticker}: {e}")
        return {"ticker": ticker, "error": str(e)}


def _fetch_history_sync(ticker: str, period: str = "1y") -> list:
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=period)
        return [
            {"date": str(idx.date()), "close": row["Close"]}
            for idx, row in hist.iterrows()
        ]
    except Exception as e:
        logger.warning(f"Failed to fetch history for {ticker}: {e}")
        return []


async def get_stock_info(ticker: str) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_fetch_stock_info_sync, ticker))


async def get_price(ticker: str) -> float | None:
    info = await get_stock_info(ticker)
    return info.get("price")


async def get_history(ticker: str, period: str = "1y") -> list:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_fetch_history_sync, ticker, period))
