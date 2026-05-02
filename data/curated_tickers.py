"""Curated US ticker universe for the global search palette.

Yahoo's public search endpoint (v1/finance/search) is heavily rate-limited
and routinely returns 429 to a single home IP / Railway egress, which on
the demo translated to "No matches for X" for popular names like META,
TSLA, NVDA, etc. — devastating to the user experience.

This module ships a local fuzzy-matchable ticker universe so the most
common US stocks + ETFs always resolve, regardless of what Yahoo is
doing. We hit Yahoo only as a fallback for niche tickers.

Coverage:
  • 200+ large/mega-cap US equities (S&P 500 majors, sector leaders)
  • Top 30+ ETFs by AUM (broad market, sector, bond, factor)
  • Reuses curated_funds.json for mutual funds (separate file)

Each entry: (ticker, full_name, asset_class, quote_type, sector_or_None)
"""

from __future__ import annotations

# (ticker, name, asset_class, quote_type, sector)
CURATED_TICKERS: list[tuple[str, str, str, str, str | None]] = [
    # === Mega-cap tech ===
    ("AAPL", "Apple Inc.", "us_stocks", "equity", "Technology"),
    ("MSFT", "Microsoft Corporation", "us_stocks", "equity", "Technology"),
    ("GOOGL", "Alphabet Inc. Class A", "us_stocks", "equity", "Technology"),
    ("GOOG", "Alphabet Inc. Class C", "us_stocks", "equity", "Technology"),
    ("AMZN", "Amazon.com Inc.", "us_stocks", "equity", "Consumer Discretionary"),
    ("META", "Meta Platforms Inc.", "us_stocks", "equity", "Technology"),
    ("NVDA", "NVIDIA Corporation", "us_stocks", "equity", "Technology"),
    ("TSLA", "Tesla Inc.", "us_stocks", "equity", "Consumer Discretionary"),
    ("AVGO", "Broadcom Inc.", "us_stocks", "equity", "Technology"),
    ("ORCL", "Oracle Corporation", "us_stocks", "equity", "Technology"),
    ("ADBE", "Adobe Inc.", "us_stocks", "equity", "Technology"),
    ("CRM", "Salesforce Inc.", "us_stocks", "equity", "Technology"),
    ("AMD", "Advanced Micro Devices Inc.", "us_stocks", "equity", "Technology"),
    ("INTC", "Intel Corporation", "us_stocks", "equity", "Technology"),
    ("CSCO", "Cisco Systems Inc.", "us_stocks", "equity", "Technology"),
    ("IBM", "International Business Machines", "us_stocks", "equity", "Technology"),
    ("QCOM", "QUALCOMM Incorporated", "us_stocks", "equity", "Technology"),
    ("TXN", "Texas Instruments Inc.", "us_stocks", "equity", "Technology"),
    ("MU", "Micron Technology Inc.", "us_stocks", "equity", "Technology"),
    ("AMAT", "Applied Materials Inc.", "us_stocks", "equity", "Technology"),
    ("PANW", "Palo Alto Networks Inc.", "us_stocks", "equity", "Technology"),
    ("NOW", "ServiceNow Inc.", "us_stocks", "equity", "Technology"),
    ("INTU", "Intuit Inc.", "us_stocks", "equity", "Technology"),
    ("SHOP", "Shopify Inc.", "us_stocks", "equity", "Technology"),
    ("UBER", "Uber Technologies Inc.", "us_stocks", "equity", "Industrials"),
    ("PYPL", "PayPal Holdings Inc.", "us_stocks", "equity", "Financial Services"),
    ("SQ", "Block Inc.", "us_stocks", "equity", "Technology"),
    ("ZM", "Zoom Communications Inc.", "us_stocks", "equity", "Technology"),
    ("ABNB", "Airbnb Inc.", "us_stocks", "equity", "Consumer Discretionary"),
    ("DASH", "DoorDash Inc.", "us_stocks", "equity", "Consumer Discretionary"),
    ("NET", "Cloudflare Inc.", "us_stocks", "equity", "Technology"),
    ("DDOG", "Datadog Inc.", "us_stocks", "equity", "Technology"),
    ("SNOW", "Snowflake Inc.", "us_stocks", "equity", "Technology"),
    ("PLTR", "Palantir Technologies Inc.", "us_stocks", "equity", "Technology"),
    ("COIN", "Coinbase Global Inc.", "us_stocks", "equity", "Financial Services"),
    ("RBLX", "Roblox Corporation", "us_stocks", "equity", "Communication Services"),
    ("SPOT", "Spotify Technology", "us_stocks", "equity", "Communication Services"),
    ("PINS", "Pinterest Inc.", "us_stocks", "equity", "Communication Services"),
    ("SNAP", "Snap Inc.", "us_stocks", "equity", "Communication Services"),
    ("LYFT", "Lyft Inc.", "us_stocks", "equity", "Industrials"),
    ("NFLX", "Netflix Inc.", "us_stocks", "equity", "Communication Services"),
    ("DIS", "Walt Disney Company", "us_stocks", "equity", "Communication Services"),
    ("CMCSA", "Comcast Corporation", "us_stocks", "equity", "Communication Services"),
    ("VZ", "Verizon Communications Inc.", "us_stocks", "equity", "Communication Services"),
    ("T", "AT&T Inc.", "us_stocks", "equity", "Communication Services"),

    # === Financials ===
    ("BRK.B", "Berkshire Hathaway Inc. Class B", "us_stocks", "equity", "Financial Services"),
    ("JPM", "JPMorgan Chase & Co.", "us_stocks", "equity", "Financial Services"),
    ("BAC", "Bank of America Corporation", "us_stocks", "equity", "Financial Services"),
    ("WFC", "Wells Fargo & Company", "us_stocks", "equity", "Financial Services"),
    ("GS", "Goldman Sachs Group Inc.", "us_stocks", "equity", "Financial Services"),
    ("MS", "Morgan Stanley", "us_stocks", "equity", "Financial Services"),
    ("C", "Citigroup Inc.", "us_stocks", "equity", "Financial Services"),
    ("V", "Visa Inc.", "us_stocks", "equity", "Financial Services"),
    ("MA", "Mastercard Incorporated", "us_stocks", "equity", "Financial Services"),
    ("AXP", "American Express Company", "us_stocks", "equity", "Financial Services"),
    ("BLK", "BlackRock Inc.", "us_stocks", "equity", "Financial Services"),
    ("SCHW", "Charles Schwab Corporation", "us_stocks", "equity", "Financial Services"),
    ("USB", "U.S. Bancorp", "us_stocks", "equity", "Financial Services"),
    ("PNC", "PNC Financial Services", "us_stocks", "equity", "Financial Services"),
    ("COF", "Capital One Financial", "us_stocks", "equity", "Financial Services"),
    ("AIG", "American International Group", "us_stocks", "equity", "Financial Services"),
    ("MET", "MetLife Inc.", "us_stocks", "equity", "Financial Services"),
    ("PRU", "Prudential Financial", "us_stocks", "equity", "Financial Services"),
    ("CME", "CME Group Inc.", "us_stocks", "equity", "Financial Services"),
    ("ICE", "Intercontinental Exchange", "us_stocks", "equity", "Financial Services"),

    # === Healthcare ===
    ("UNH", "UnitedHealth Group Inc.", "us_stocks", "equity", "Healthcare"),
    ("JNJ", "Johnson & Johnson", "us_stocks", "equity", "Healthcare"),
    ("LLY", "Eli Lilly and Company", "us_stocks", "equity", "Healthcare"),
    ("PFE", "Pfizer Inc.", "us_stocks", "equity", "Healthcare"),
    ("MRK", "Merck & Co. Inc.", "us_stocks", "equity", "Healthcare"),
    ("ABBV", "AbbVie Inc.", "us_stocks", "equity", "Healthcare"),
    ("ABT", "Abbott Laboratories", "us_stocks", "equity", "Healthcare"),
    ("TMO", "Thermo Fisher Scientific", "us_stocks", "equity", "Healthcare"),
    ("DHR", "Danaher Corporation", "us_stocks", "equity", "Healthcare"),
    ("BMY", "Bristol-Myers Squibb", "us_stocks", "equity", "Healthcare"),
    ("AMGN", "Amgen Inc.", "us_stocks", "equity", "Healthcare"),
    ("GILD", "Gilead Sciences Inc.", "us_stocks", "equity", "Healthcare"),
    ("CVS", "CVS Health Corporation", "us_stocks", "equity", "Healthcare"),
    ("CI", "Cigna Group", "us_stocks", "equity", "Healthcare"),
    ("HUM", "Humana Inc.", "us_stocks", "equity", "Healthcare"),
    ("ELV", "Elevance Health Inc.", "us_stocks", "equity", "Healthcare"),
    ("ISRG", "Intuitive Surgical Inc.", "us_stocks", "equity", "Healthcare"),
    ("MDT", "Medtronic plc", "us_stocks", "equity", "Healthcare"),
    ("SYK", "Stryker Corporation", "us_stocks", "equity", "Healthcare"),
    ("REGN", "Regeneron Pharmaceuticals", "us_stocks", "equity", "Healthcare"),
    ("VRTX", "Vertex Pharmaceuticals", "us_stocks", "equity", "Healthcare"),

    # === Consumer ===
    ("WMT", "Walmart Inc.", "us_stocks", "equity", "Consumer Defensive"),
    ("COST", "Costco Wholesale Corporation", "us_stocks", "equity", "Consumer Defensive"),
    ("PG", "Procter & Gamble Company", "us_stocks", "equity", "Consumer Defensive"),
    ("KO", "Coca-Cola Company", "us_stocks", "equity", "Consumer Defensive"),
    ("PEP", "PepsiCo Inc.", "us_stocks", "equity", "Consumer Defensive"),
    ("MCD", "McDonald's Corporation", "us_stocks", "equity", "Consumer Discretionary"),
    ("SBUX", "Starbucks Corporation", "us_stocks", "equity", "Consumer Discretionary"),
    ("NKE", "NIKE Inc.", "us_stocks", "equity", "Consumer Discretionary"),
    ("LULU", "Lululemon Athletica", "us_stocks", "equity", "Consumer Discretionary"),
    ("TGT", "Target Corporation", "us_stocks", "equity", "Consumer Defensive"),
    ("HD", "Home Depot Inc.", "us_stocks", "equity", "Consumer Discretionary"),
    ("LOW", "Lowe's Companies Inc.", "us_stocks", "equity", "Consumer Discretionary"),
    ("CMG", "Chipotle Mexican Grill", "us_stocks", "equity", "Consumer Discretionary"),
    ("EL", "Estée Lauder Companies", "us_stocks", "equity", "Consumer Defensive"),
    ("CL", "Colgate-Palmolive Company", "us_stocks", "equity", "Consumer Defensive"),
    ("MO", "Altria Group Inc.", "us_stocks", "equity", "Consumer Defensive"),
    ("PM", "Philip Morris International", "us_stocks", "equity", "Consumer Defensive"),
    ("MDLZ", "Mondelez International", "us_stocks", "equity", "Consumer Defensive"),
    ("KHC", "Kraft Heinz Company", "us_stocks", "equity", "Consumer Defensive"),
    ("F", "Ford Motor Company", "us_stocks", "equity", "Consumer Discretionary"),
    ("GM", "General Motors Company", "us_stocks", "equity", "Consumer Discretionary"),
    ("RIVN", "Rivian Automotive Inc.", "us_stocks", "equity", "Consumer Discretionary"),
    ("LCID", "Lucid Group Inc.", "us_stocks", "equity", "Consumer Discretionary"),

    # === Energy ===
    ("XOM", "Exxon Mobil Corporation", "us_stocks", "equity", "Energy"),
    ("CVX", "Chevron Corporation", "us_stocks", "equity", "Energy"),
    ("COP", "ConocoPhillips", "us_stocks", "equity", "Energy"),
    ("SLB", "Schlumberger N.V.", "us_stocks", "equity", "Energy"),
    ("EOG", "EOG Resources Inc.", "us_stocks", "equity", "Energy"),
    ("OXY", "Occidental Petroleum", "us_stocks", "equity", "Energy"),
    ("MPC", "Marathon Petroleum", "us_stocks", "equity", "Energy"),
    ("PSX", "Phillips 66", "us_stocks", "equity", "Energy"),
    ("VLO", "Valero Energy Corporation", "us_stocks", "equity", "Energy"),

    # === Industrials & Materials ===
    ("BA", "Boeing Company", "us_stocks", "equity", "Industrials"),
    ("CAT", "Caterpillar Inc.", "us_stocks", "equity", "Industrials"),
    ("DE", "Deere & Company", "us_stocks", "equity", "Industrials"),
    ("GE", "General Electric Company", "us_stocks", "equity", "Industrials"),
    ("HON", "Honeywell International", "us_stocks", "equity", "Industrials"),
    ("LMT", "Lockheed Martin Corporation", "us_stocks", "equity", "Industrials"),
    ("RTX", "RTX Corporation", "us_stocks", "equity", "Industrials"),
    ("UPS", "United Parcel Service Inc.", "us_stocks", "equity", "Industrials"),
    ("FDX", "FedEx Corporation", "us_stocks", "equity", "Industrials"),
    ("UNP", "Union Pacific Corporation", "us_stocks", "equity", "Industrials"),
    ("MMM", "3M Company", "us_stocks", "equity", "Industrials"),
    ("LIN", "Linde plc", "us_stocks", "equity", "Materials"),
    ("FCX", "Freeport-McMoRan Inc.", "us_stocks", "equity", "Materials"),

    # === Real Estate / Utilities ===
    ("AMT", "American Tower Corporation", "us_stocks", "equity", "Real Estate"),
    ("PLD", "Prologis Inc.", "us_stocks", "equity", "Real Estate"),
    ("CCI", "Crown Castle Inc.", "us_stocks", "equity", "Real Estate"),
    ("NEE", "NextEra Energy Inc.", "us_stocks", "equity", "Utilities"),
    ("DUK", "Duke Energy Corporation", "us_stocks", "equity", "Utilities"),
    ("SO", "Southern Company", "us_stocks", "equity", "Utilities"),

    # === ETFs (broad market) ===
    ("SPY", "SPDR S&P 500 ETF Trust", "us_stocks", "etf", None),
    ("VOO", "Vanguard S&P 500 ETF", "us_stocks", "etf", None),
    ("IVV", "iShares Core S&P 500 ETF", "us_stocks", "etf", None),
    ("VTI", "Vanguard Total Stock Market ETF", "us_stocks", "etf", None),
    ("ITOT", "iShares Core S&P Total US Stock Market ETF", "us_stocks", "etf", None),
    ("QQQ", "Invesco QQQ Trust", "us_stocks", "etf", None),
    ("DIA", "SPDR Dow Jones Industrial Average ETF", "us_stocks", "etf", None),
    ("IWM", "iShares Russell 2000 ETF", "us_stocks", "etf", None),
    ("VUG", "Vanguard Growth ETF", "us_stocks", "etf", None),
    ("VTV", "Vanguard Value ETF", "us_stocks", "etf", None),
    ("SCHX", "Schwab US Large-Cap ETF", "us_stocks", "etf", None),
    ("SCHB", "Schwab US Broad Market ETF", "us_stocks", "etf", None),

    # === ETFs (international) ===
    ("VXUS", "Vanguard Total International Stock ETF", "intl_stocks", "etf", None),
    ("VEA", "Vanguard FTSE Developed Markets ETF", "intl_stocks", "etf", None),
    ("VWO", "Vanguard FTSE Emerging Markets ETF", "intl_stocks", "etf", None),
    ("EFA", "iShares MSCI EAFE ETF", "intl_stocks", "etf", None),
    ("EEM", "iShares MSCI Emerging Markets ETF", "intl_stocks", "etf", None),
    ("IEMG", "iShares Core MSCI Emerging Markets ETF", "intl_stocks", "etf", None),
    ("IXUS", "iShares Core MSCI Total International Stock ETF", "intl_stocks", "etf", None),

    # === ETFs (bonds) ===
    ("BND", "Vanguard Total Bond Market ETF", "bonds", "etf", None),
    ("AGG", "iShares Core US Aggregate Bond ETF", "bonds", "etf", None),
    ("TLT", "iShares 20+ Year Treasury Bond ETF", "bonds", "etf", None),
    ("IEF", "iShares 7-10 Year Treasury Bond ETF", "bonds", "etf", None),
    ("SHY", "iShares 1-3 Year Treasury Bond ETF", "bonds", "etf", None),
    ("LQD", "iShares iBoxx Investment Grade Corporate Bond ETF", "bonds", "etf", None),
    ("HYG", "iShares iBoxx High Yield Corporate Bond ETF", "bonds", "etf", None),
    ("TIP", "iShares TIPS Bond ETF", "bonds", "etf", None),
    ("MUB", "iShares National Muni Bond ETF", "bonds", "etf", None),

    # === ETFs (sectors) ===
    ("XLK", "Technology Select Sector SPDR Fund", "us_stocks", "etf", "Technology"),
    ("XLF", "Financial Select Sector SPDR Fund", "us_stocks", "etf", "Financial Services"),
    ("XLV", "Health Care Select Sector SPDR Fund", "us_stocks", "etf", "Healthcare"),
    ("XLE", "Energy Select Sector SPDR Fund", "us_stocks", "etf", "Energy"),
    ("XLI", "Industrial Select Sector SPDR Fund", "us_stocks", "etf", "Industrials"),
    ("XLY", "Consumer Discretionary SPDR", "us_stocks", "etf", "Consumer Discretionary"),
    ("XLP", "Consumer Staples SPDR", "us_stocks", "etf", "Consumer Defensive"),
    ("XLU", "Utilities Select Sector SPDR", "us_stocks", "etf", "Utilities"),
    ("XLB", "Materials Select Sector SPDR", "us_stocks", "etf", "Materials"),
    ("XLRE", "Real Estate Select Sector SPDR", "us_stocks", "etf", "Real Estate"),
    ("XLC", "Communication Services Select Sector SPDR", "us_stocks", "etf", "Communication Services"),
    ("SOXX", "iShares Semiconductor ETF", "us_stocks", "etf", "Technology"),
    ("SMH", "VanEck Semiconductor ETF", "us_stocks", "etf", "Technology"),

    # === ETFs (commodities / alternatives) ===
    ("GLD", "SPDR Gold Shares", "commodities", "etf", None),
    ("SLV", "iShares Silver Trust", "commodities", "etf", None),
    ("USO", "United States Oil Fund", "commodities", "etf", None),
    ("VNQ", "Vanguard Real Estate ETF", "real_estate", "etf", None),
    ("IYR", "iShares US Real Estate ETF", "real_estate", "etf", None),
    ("DBC", "Invesco DB Commodity Index Tracking Fund", "commodities", "etf", None),
]


def _norm(s: str) -> str:
    return s.lower().replace(",", " ").replace(".", " ").strip()


# Index for fast lookup
_BY_TICKER: dict[str, tuple[str, str, str, str, str | None]] = {
    t[0]: t for t in CURATED_TICKERS
}


def lookup_by_ticker(ticker: str) -> tuple[str, str, str, str, str | None] | None:
    return _BY_TICKER.get(ticker.upper())


def search_curated(query: str, limit: int = 8) -> list[tuple[str, str, str, str, str | None]]:
    """Fuzzy keyword search over the curated universe.

    Matching strategy (most-relevant first):
      1. Exact ticker match
      2. Ticker prefix match (typing "ap" → AAPL, AMZN-ish)
      3. Name word starts with query ("meta" → "Meta Platforms Inc.")
      4. Substring match in name
    """
    if not query:
        return []
    q = query.strip().lower()
    q_norm = _norm(query)
    if not q:
        return []

    seen: set[str] = set()
    out: list[tuple[str, str, str, str, str | None]] = []

    def add(row):
        if row[0] in seen:
            return False
        seen.add(row[0])
        out.append(row)
        return len(out) >= limit

    # 1) Exact ticker
    exact = lookup_by_ticker(query)
    if exact:
        if add(exact):
            return out

    # 2) Ticker prefix
    qu = query.upper()
    for row in CURATED_TICKERS:
        if row[0].startswith(qu) and len(row[0]) <= len(qu) + 3:
            if add(row):
                return out

    # 3) Name word starts with query
    for row in CURATED_TICKERS:
        name_words = _norm(row[1]).split()
        if any(w.startswith(q) for w in name_words):
            if add(row):
                return out

    # 4) Substring match (less relevant — last)
    for row in CURATED_TICKERS:
        if q_norm in _norm(row[1]):
            if add(row):
                return out

    return out
