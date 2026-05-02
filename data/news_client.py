import hashlib
from datetime import datetime, timezone
import httpx
import feedparser
from core.config import settings
from core.logger import get_logger

logger = get_logger("news_client")

NEWS_SOURCES = [
    "https://finance.yahoo.com/news/rssindex",
    "https://feeds.finance.yahoo.com/rss/2.0/headline",
]

MACRO_KEYWORDS = [
    "fed rate", "interest rate", "inflation", "recession", "gdp",
    "unemployment", "earnings", "dividend", "merger", "acquisition",
    "bankruptcy", "sec", "investigation", "rate hike", "rate cut",
]

# Yahoo Finance RSS is heavily polluted with affiliate / SEO content
# ("Best credit cards for May 2026", "Best Buy Affirm partnership", etc.)
# that has nothing to do with markets. We strip these BEFORE storing
# them so Activity tab shows useful headlines and we don't waste Claude
# tokens classifying credit-card listicles for every user.
_JUNK_PHRASES = (
    "best credit card",
    "credit cards for",
    "best business credit",
    "best capital one",
    "best american express",
    "best citi credit",
    "best chase",
    "best discover",
    "best of bank of america",
    "best airline credit",
    "best hotel credit",
    "best gas credit",
    "best disney credit",
    "best buy credit",
    "best balance transfer",
    "best cash back",
    "best travel credit",
    "best rewards credit",
    "best secured credit",
    "best student credit",
    "best 0%",
    "best apr",
)


def _is_junk(title: str) -> bool:
    t = title.lower()
    if any(p in t for p in _JUNK_PHRASES):
        return True
    # Pure listicles that don't reference a ticker or company action.
    if t.startswith("best ") and (" credit" in t or " card" in t or " loan" in t):
        return True
    return False


def _headline_hash(headline: str) -> str:
    return hashlib.md5(headline.lower().strip().encode()).hexdigest()


def _normalize_published(entry) -> str | None:
    """Return an ISO-8601 UTC timestamp for the entry, or None if missing.

    feedparser fills `published_parsed` (a struct_time in UTC) for most feeds.
    We refuse to fall back to "now" — better to leave it null than to label
    an event with a fake timestamp that the LLM might call "today".
    """
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if not parsed:
        return None
    try:
        return datetime(*parsed[:6], tzinfo=timezone.utc).isoformat()
    except Exception:
        return None


async def fetch_rss_headlines() -> list[dict]:
    headlines = []
    for url in NEWS_SOURCES:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:30]:
                title = entry.get("title", "").strip()
                if not title or _is_junk(title):
                    continue
                headlines.append(
                    {
                        "headline": title,
                        "source": feed.feed.get("title", url),
                        "url": entry.get("link", ""),
                        "published_at": _normalize_published(entry),
                        "hash": _headline_hash(title),
                    }
                )
        except Exception as e:
            logger.warning(f"RSS fetch failed for {url}: {e}")
    return headlines


async def fetch_newsapi_headlines(query: str = "finance stocks investing") -> list[dict]:
    if not settings.news_api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": 20,
                    "apiKey": settings.news_api_key,
                },
            )
            resp.raise_for_status()
            articles = resp.json().get("articles", [])
            return [
                {
                    "headline": a["title"],
                    "source": a.get("source", {}).get("name", ""),
                    "url": a.get("url", ""),
                    "published_at": a.get("publishedAt", ""),
                    "hash": _headline_hash(a["title"]),
                }
                for a in articles
                if a.get("title") and not _is_junk(a["title"])
            ]
    except Exception as e:
        logger.warning(f"NewsAPI fetch failed: {e}")
        return []


def is_macro_relevant(headline: str) -> bool:
    lower = headline.lower()
    return any(kw in lower for kw in MACRO_KEYWORDS)
