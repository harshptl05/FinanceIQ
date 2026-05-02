/**
 * Client-side curated ticker shortlist.
 *
 * The backend has a 200-ticker curated list at `data/curated_tickers.py`,
 * but the frontend palette deserves a no-network safety net: when the
 * user types "meta", they should see META Platforms instantly, even if
 * the API is slow / 401'd / cold-starting. The network call still goes
 * out in parallel — we merge real prices in as they arrive.
 *
 * Coverage: ~120 most-searched US tickers + popular ETFs + a handful
 * of mutual funds. Not exhaustive — niche names still rely on the
 * backend's keyword search.
 */

export type CuratedRow = {
  ticker: string;
  name: string;
  asset_class: string;
  quote_type: 'equity' | 'etf' | 'mutualfund';
};

// Mirrors backend `data/curated_tickers.py` for the top names and adds
// the curated mutual funds we ship with the demo.
export const CURATED_TICKERS: CuratedRow[] = [
  // ── Mega-cap tech ──
  { ticker: 'AAPL', name: 'Apple Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'GOOGL', name: 'Alphabet Inc. Class A', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'GOOG', name: 'Alphabet Inc. Class C', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'META', name: 'Meta Platforms Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'TSLA', name: 'Tesla Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'AVGO', name: 'Broadcom Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'ORCL', name: 'Oracle Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'ADBE', name: 'Adobe Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'CRM', name: 'Salesforce Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'AMD', name: 'Advanced Micro Devices Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'INTC', name: 'Intel Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'CSCO', name: 'Cisco Systems Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'IBM', name: 'International Business Machines', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'QCOM', name: 'QUALCOMM Incorporated', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'TXN', name: 'Texas Instruments Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'NOW', name: 'ServiceNow Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'INTU', name: 'Intuit Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'PANW', name: 'Palo Alto Networks Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'PYPL', name: 'PayPal Holdings Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'SHOP', name: 'Shopify Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'UBER', name: 'Uber Technologies Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'ABNB', name: 'Airbnb Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'SNOW', name: 'Snowflake Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'PLTR', name: 'Palantir Technologies Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'COIN', name: 'Coinbase Global Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'NET', name: 'Cloudflare Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'DDOG', name: 'Datadog Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'SPOT', name: 'Spotify Technology', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'NFLX', name: 'Netflix Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'DIS', name: 'Walt Disney Company', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'CMCSA', name: 'Comcast Corporation', asset_class: 'us_stocks', quote_type: 'equity' },

  // ── Financials ──
  { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc. Class B', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'BAC', name: 'Bank of America Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'WFC', name: 'Wells Fargo & Company', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'GS', name: 'Goldman Sachs Group Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'MS', name: 'Morgan Stanley', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'V', name: 'Visa Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'MA', name: 'Mastercard Incorporated', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'AXP', name: 'American Express Company', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'BLK', name: 'BlackRock Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'SCHW', name: 'Charles Schwab Corporation', asset_class: 'us_stocks', quote_type: 'equity' },

  // ── Healthcare ──
  { ticker: 'UNH', name: 'UnitedHealth Group Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'LLY', name: 'Eli Lilly and Company', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'PFE', name: 'Pfizer Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'MRK', name: 'Merck & Co. Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'ABBV', name: 'AbbVie Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'ABT', name: 'Abbott Laboratories', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'TMO', name: 'Thermo Fisher Scientific', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'AMGN', name: 'Amgen Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'GILD', name: 'Gilead Sciences Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'CVS', name: 'CVS Health Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'ISRG', name: 'Intuitive Surgical Inc.', asset_class: 'us_stocks', quote_type: 'equity' },

  // ── Consumer ──
  { ticker: 'WMT', name: 'Walmart Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'COST', name: 'Costco Wholesale Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'PG', name: 'Procter & Gamble Company', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'KO', name: 'Coca-Cola Company', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'PEP', name: 'PepsiCo Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'MCD', name: "McDonald's Corporation", asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'SBUX', name: 'Starbucks Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'NKE', name: 'NIKE Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'HD', name: 'Home Depot Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'LOW', name: "Lowe's Companies Inc.", asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'TGT', name: 'Target Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'F', name: 'Ford Motor Company', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'GM', name: 'General Motors Company', asset_class: 'us_stocks', quote_type: 'equity' },

  // ── Energy / Industrials ──
  { ticker: 'XOM', name: 'Exxon Mobil Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'CVX', name: 'Chevron Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'COP', name: 'ConocoPhillips', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'BA', name: 'Boeing Company', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'CAT', name: 'Caterpillar Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'GE', name: 'General Electric Company', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'HON', name: 'Honeywell International', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'LMT', name: 'Lockheed Martin Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'UPS', name: 'United Parcel Service Inc.', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'FDX', name: 'FedEx Corporation', asset_class: 'us_stocks', quote_type: 'equity' },
  { ticker: 'MMM', name: '3M Company', asset_class: 'us_stocks', quote_type: 'equity' },

  // ── Broad-market ETFs ──
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'IVV', name: 'iShares Core S&P 500 ETF', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'IWM', name: 'iShares Russell 2000 ETF', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'VUG', name: 'Vanguard Growth ETF', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'VTV', name: 'Vanguard Value ETF', asset_class: 'us_stocks', quote_type: 'etf' },

  // ── International ETFs ──
  { ticker: 'VXUS', name: 'Vanguard Total International Stock ETF', asset_class: 'intl_stocks', quote_type: 'etf' },
  { ticker: 'VEA', name: 'Vanguard FTSE Developed Markets ETF', asset_class: 'intl_stocks', quote_type: 'etf' },
  { ticker: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF', asset_class: 'intl_stocks', quote_type: 'etf' },
  { ticker: 'EFA', name: 'iShares MSCI EAFE ETF', asset_class: 'intl_stocks', quote_type: 'etf' },

  // ── Bond ETFs ──
  { ticker: 'BND', name: 'Vanguard Total Bond Market ETF', asset_class: 'bonds', quote_type: 'etf' },
  { ticker: 'AGG', name: 'iShares Core US Aggregate Bond ETF', asset_class: 'bonds', quote_type: 'etf' },
  { ticker: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', asset_class: 'bonds', quote_type: 'etf' },
  { ticker: 'HYG', name: 'iShares iBoxx High Yield Corporate Bond ETF', asset_class: 'bonds', quote_type: 'etf' },
  { ticker: 'TIP', name: 'iShares TIPS Bond ETF', asset_class: 'bonds', quote_type: 'etf' },

  // ── Sector ETFs ──
  { ticker: 'XLK', name: 'Technology Select Sector SPDR Fund', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'XLF', name: 'Financial Select Sector SPDR Fund', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'XLV', name: 'Health Care Select Sector SPDR Fund', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'XLE', name: 'Energy Select Sector SPDR Fund', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'XLI', name: 'Industrial Select Sector SPDR Fund', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'SOXX', name: 'iShares Semiconductor ETF', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'SMH', name: 'VanEck Semiconductor ETF', asset_class: 'us_stocks', quote_type: 'etf' },
  { ticker: 'GLD', name: 'SPDR Gold Shares', asset_class: 'commodities', quote_type: 'etf' },
  { ticker: 'VNQ', name: 'Vanguard Real Estate ETF', asset_class: 'real_estate', quote_type: 'etf' },

  // ── Mutual funds (curated demo set) ──
  { ticker: 'VFIAX', name: 'Vanguard 500 Index Admiral', asset_class: 'us_stocks', quote_type: 'mutualfund' },
  { ticker: 'VTSAX', name: 'Vanguard Total Stock Market Admiral', asset_class: 'us_stocks', quote_type: 'mutualfund' },
  { ticker: 'FXAIX', name: 'Fidelity 500 Index', asset_class: 'us_stocks', quote_type: 'mutualfund' },
  { ticker: 'FCNTX', name: 'Fidelity Contrafund', asset_class: 'us_stocks', quote_type: 'mutualfund' },
  { ticker: 'VBTLX', name: 'Vanguard Total Bond Market Admiral', asset_class: 'bonds', quote_type: 'mutualfund' },
  { ticker: 'VTIAX', name: 'Vanguard Total International Stock Admiral', asset_class: 'intl_stocks', quote_type: 'mutualfund' },
  { ticker: 'VMFXX', name: 'Vanguard Federal Money Market', asset_class: 'cash', quote_type: 'mutualfund' },
  { ticker: 'SPAXX', name: 'Fidelity Government Money Market', asset_class: 'cash', quote_type: 'mutualfund' },
];

const _BY_TICKER = new Map(
  CURATED_TICKERS.map((r) => [r.ticker.toUpperCase(), r] as const),
);

const _norm = (s: string) =>
  s.toLowerCase().replace(/,/g, ' ').replace(/\./g, ' ').trim();

/**
 * Local fuzzy search. Mirrors the backend's matching strategy so the
 * client and server agree on what "matches" mean:
 *
 *   1. Exact ticker (META → META)
 *   2. Ticker prefix (NV → NVDA, NVO, …)
 *   3. Name word starts-with (apple → AAPL)
 *   4. Name substring (last resort)
 */
export function searchCuratedLocal(
  query: string,
  limit = 6,
): CuratedRow[] {
  const q = query.trim();
  if (!q) return [];
  const qu = q.toUpperCase();
  const ql = q.toLowerCase();
  const qNorm = _norm(q);

  const seen = new Set<string>();
  const out: CuratedRow[] = [];

  const push = (row: CuratedRow): boolean => {
    if (seen.has(row.ticker)) return false;
    seen.add(row.ticker);
    out.push(row);
    return out.length >= limit;
  };

  const exact = _BY_TICKER.get(qu);
  if (exact && push(exact)) return out;

  for (const row of CURATED_TICKERS) {
    if (row.ticker.startsWith(qu) && row.ticker.length <= qu.length + 3) {
      if (push(row)) return out;
    }
  }
  for (const row of CURATED_TICKERS) {
    const words = _norm(row.name).split(/\s+/);
    if (words.some((w) => w.startsWith(ql))) {
      if (push(row)) return out;
    }
  }
  for (const row of CURATED_TICKERS) {
    if (_norm(row.name).includes(qNorm)) {
      if (push(row)) return out;
    }
  }
  return out;
}
