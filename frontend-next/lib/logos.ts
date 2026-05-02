/**
 * logo.dev integration. Their stock-ticker endpoint returns a clean square
 * brand mark when given a ticker.
 *
 * IMPORTANT: must be a *publishable* key (`pk_...`). Secret keys (`sk_...`)
 * return 401 when called from the browser. The `TickerLogo` component
 * gracefully falls back to a colored letter chip when the image fails.
 *
 * Token order:
 *   1. NEXT_PUBLIC_LOGO_DEV_KEY  (canonical name in logo.dev docs)
 *   2. NEXT_PUBLIC_LOGO_DEV_TOKEN (legacy name, kept for back-compat)
 *   3. hard-coded fallback below
 */
const FALLBACK_TOKEN = 'pk_UjXRtEWXRDSBFeKGb5mbfg';

export function logoDevToken(): string {
  return (
    process.env.NEXT_PUBLIC_LOGO_DEV_KEY?.trim() ||
    process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN?.trim() ||
    FALLBACK_TOKEN
  );
}

/** Returns a square-cropped brand mark URL for a ticker symbol. */
export function tickerLogoUrl(
  ticker: string,
  size: 64 | 96 | 128 | 200 = 96,
  format: 'png' | 'webp' = 'webp',
): string {
  const t = encodeURIComponent(ticker.toUpperCase().trim());
  const params = new URLSearchParams({
    token: logoDevToken(),
    size: String(size),
    format,
    retina: 'true',
  });
  return `https://img.logo.dev/ticker/${t}?${params.toString()}`;
}

/** logo.dev's company-domain endpoint. Used as a fallback for tickers
 *  that don't resolve via /ticker/ — most notably mutual fund symbols
 *  (VFIAX, FXAIX, FCNTX, …), which the ticker endpoint doesn't cover.
 *  Pass a bare host like "vanguard.com". */
export function domainLogoUrl(
  domain: string,
  size: 64 | 96 | 128 | 200 = 96,
  format: 'png' | 'webp' = 'webp',
): string {
  const d = encodeURIComponent(domain.trim());
  const params = new URLSearchParams({
    token: logoDevToken(),
    size: String(size),
    format,
    retina: 'true',
  });
  return `https://img.logo.dev/${d}?${params.toString()}`;
}

/**
 * Map a mutual-fund / ETF ticker to its issuer's web domain. logo.dev's
 * `/ticker/` endpoint doesn't have entries for mutual fund symbols
 * (VFIAX, FXAIX, FCNTX, etc.), but `/{domain}/` does — so when ticker
 * lookup fails we can still surface a real brand mark by falling back
 * to the issuer (Vanguard's V, Fidelity's green-on-black, …).
 *
 * Detection is twofold:
 *   1. Explicit overrides for tickers that don't follow the prefix rule.
 *   2. Issuer prefix: most US mutual funds get a one-letter family
 *      prefix (V = Vanguard, F = Fidelity, S = Schwab/State Street, …).
 *
 * Returns null when we can't make a confident guess — the caller
 * should fall through to the colored letter chip in that case.
 */
const TICKER_DOMAIN_OVERRIDES: Record<string, string> = {
  // Vanguard ETFs (covered by /ticker/ but listed for completeness)
  VTI: 'vanguard.com',
  VOO: 'vanguard.com',
  VXUS: 'vanguard.com',
  VEA: 'vanguard.com',
  VWO: 'vanguard.com',
  BND: 'vanguard.com',
  // SPDR family
  SPY: 'ssga.com',
  DIA: 'ssga.com',
  XLK: 'ssga.com',
  XLF: 'ssga.com',
  XLV: 'ssga.com',
  XLE: 'ssga.com',
  XLI: 'ssga.com',
  XLY: 'ssga.com',
  XLP: 'ssga.com',
  XLU: 'ssga.com',
  XLB: 'ssga.com',
  XLRE: 'ssga.com',
  XLC: 'ssga.com',
  GLD: 'ssga.com',
  // iShares
  IVV: 'ishares.com',
  AGG: 'ishares.com',
  TLT: 'ishares.com',
  IEF: 'ishares.com',
  HYG: 'ishares.com',
  TIP: 'ishares.com',
  EFA: 'ishares.com',
  EEM: 'ishares.com',
  IEMG: 'ishares.com',
  IWM: 'ishares.com',
  // Invesco
  QQQ: 'invesco.com',
  // Schwab
  SCHX: 'schwab.com',
  SCHB: 'schwab.com',
};

/** Maps the first character of an unrecognised mutual-fund ticker to
 *  its likely issuer. Coarse but works for the canonical 401k universe. */
const FUND_PREFIX_DOMAIN: Record<string, string> = {
  V: 'vanguard.com', // VFIAX, VTSAX, VTIAX, VBTLX, VMFXX, VFFVX, …
  F: 'fidelity.com', // FXAIX, FCNTX, FBGRX, FZROX, …
  S: 'schwab.com', // SWPPX, SWTSX, …
  T: 'troweprice.com', // T. Rowe Price *
  A: 'americanfunds.com', // AGTHX, AIVSX, …
  J: 'jpmorgan.com', // JEPI, JEPQ, …
};

/** True if `ticker` looks like a mutual-fund symbol (5 letters ending in X). */
function looksLikeMutualFund(t: string): boolean {
  return /^[A-Z]{4,5}X$/.test(t);
}

export function tickerIssuerDomain(ticker: string): string | null {
  const t = (ticker || '').toUpperCase().trim();
  if (!t) return null;

  const explicit = TICKER_DOMAIN_OVERRIDES[t];
  if (explicit) return explicit;

  if (looksLikeMutualFund(t)) {
    const prefix = t[0];
    return FUND_PREFIX_DOMAIN[prefix] ?? null;
  }

  return null;
}
