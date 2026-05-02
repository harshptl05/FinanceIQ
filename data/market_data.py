import asyncio
from functools import partial
import yfinance as yf
from core.logger import get_logger

logger = get_logger("market_data")


def _fetch_stock_info_sync(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        info = t.info
        fast = t.fast_info
        return {
            "ticker": ticker.upper(),
            "name": info.get("longName", ticker),
            "price": fast.last_price,
            "previous_close": fast.previous_close,
            "day_change_pct": (
                ((fast.last_price - fast.previous_close) / fast.previous_close * 100)
                if fast.previous_close
                else 0
            ),
            "market_cap": info.get("marketCap"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "fifty_two_week_high": fast.fifty_two_week_high,
            "fifty_two_week_low": fast.fifty_two_week_low,
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
