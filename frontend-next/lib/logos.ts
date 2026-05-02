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
