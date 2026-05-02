import asyncio
from functools import partial
import yfinance as yf
from core.logger import get_logger
from data.quote_providers import resolve_prices_sync

logger = get_logger("market_data")


def _fetch_stock_info_sync(ticker: str) -> dict:
    try:
        px = resolve_prices_sync(ticker)
        last_price = px[0] if px else None
        previous_close = px[1] if px else None
        day_change_pct = px[2] if px else 0.0

        t = yf.Ticker(ticker)
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
            "ticker": ticker.upper(),
            "name": info.get("longName", ticker),
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
