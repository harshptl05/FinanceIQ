import httpx
from core.config import settings
from core.logger import get_logger

logger = get_logger("fred_client")

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

FRED_INDICATORS = {
    "FEDFUNDS": "Federal Funds Rate",
    "CPIAUCSL": "CPI Inflation",
    "UNRATE": "Unemployment Rate",
    "DGS10": "10-Year Treasury Yield",
    "SP500": "S&P 500",
}


async def get_latest_value(series_id: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                FRED_BASE,
                params={
                    "series_id": series_id,
                    "api_key": settings.fred_api_key,
                    "file_type": "json",
                    "limit": 1,
                    "sort_order": "desc",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            obs = data.get("observations", [])
            if obs:
                return {
                    "series_id": series_id,
                    "name": FRED_INDICATORS.get(series_id, series_id),
                    "value": obs[0].get("value"),
                    "date": obs[0].get("date"),
                }
    except Exception as e:
        logger.warning(f"FRED fetch failed for {series_id}: {e}")
    return {"series_id": series_id, "name": FRED_INDICATORS.get(series_id, series_id), "value": None}


async def get_macro_summary() -> dict:
    import asyncio
    results = await asyncio.gather(
        *[get_latest_value(sid) for sid in FRED_INDICATORS], return_exceptions=True
    )
    summary = {}
    for r in results:
        if isinstance(r, dict) and "series_id" in r:
            summary[r["series_id"]] = r
    return summary
