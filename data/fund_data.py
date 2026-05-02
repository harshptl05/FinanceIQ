import httpx
import yfinance as yf
import asyncio
from functools import partial
from core.config import settings
from core.logger import get_logger

logger = get_logger("fund_data")


def _fetch_yf_fund_sync(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        info = t.info
        return {
            "ticker": ticker.upper(),
            "name": info.get("longName", ticker),
            "expense_ratio": info.get("annualReportExpenseRatio"),
            "category": info.get("category"),
            "fund_family": info.get("fundFamily"),
            "top_holdings": info.get("holdings", [])[:10],
            "sector_weights": info.get("sectorWeightings", []),
            "total_assets": info.get("totalAssets"),
            "ytd_return": info.get("ytdReturn"),
            "three_year_return": info.get("threeYearAverageReturn"),
            "five_year_return": info.get("fiveYearAverageReturn"),
        }
    except Exception as e:
        logger.warning(f"Fund info failed for {ticker}: {e}")
        return {"ticker": ticker, "error": str(e)}


async def get_fund_breakdown(ticker: str) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_fetch_yf_fund_sync, ticker))
