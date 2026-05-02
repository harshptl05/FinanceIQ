/**
 * Synthetic OHLC generator used by MarketChart.
 *
 * Why synthetic instead of pulling from Polygon/yfinance every page-load?
 *   - Demo runs 24/7 — markets are closed on weekends, after-hours, etc.
 *   - Free-tier rate limits would crater the demo with 6 holdings ticking.
 *   - Real-feeling movement is enough for a hackathon visual; users
 *     don't actually trade off these prices.
 *
 * We generate a deterministic random walk seeded from the ticker so the
 * same ticker always starts with a consistent-looking history (no jarring
 * jump on re-mount), then drift from there using fresh randomness on
 * every live tick.
 */

export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

/** Per-asset-class volatility tuning. Cash / money-market shouldn't bounce
 *  around; equities can. These are *per-bar* sigma fractions. */
const ASSET_VOLATILITY: Record<string, number> = {
  us_stocks: 0.0035,
  intl_stocks: 0.0040,
  bonds: 0.0010,
  cash: 0.00005, // basically flat ($1.0001 ↔ $0.9999)
  real_estate: 0.0030,
  commodities: 0.0050,
  other: 0.0025,
};

export function volatilityFor(assetClass?: string | null): number {
  return ASSET_VOLATILITY[assetClass ?? 'other'] ?? 0.0025;
}

// ---------- deterministic RNG seeded from a string ---------- //

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fast deterministic PRNG. Seed once, call repeatedly. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function next(): number {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller-ish: turn 2 uniforms into a roughly normal sample. */
function normalSample(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---------- generators ---------- //

/** Initial history: returns `count` candles ending "now", with timestamps
 *  every `barSec` seconds. The walk is seeded from the ticker so the
 *  rendered series looks identical across reloads. */
export function generateSyntheticHistory(
  ticker: string,
  basePrice: number,
  count: number = 180,
  volatility: number = 0.0035,
  barSec: number = 60,
): Candle[] {
  if (basePrice <= 0) return [];

  const rand = mulberry32(hashString(ticker || 'X'));
  const nowSec = Math.floor(Date.now() / 1000);
  // Snap to bar boundary so chart axis ticks stay clean.
  const lastBarTime = nowSec - (nowSec % barSec);

  const candles: Candle[] = [];
  // Start far enough back that the walk lands close to basePrice at the end.
  // We do a forward walk with a soft mean-reversion pull toward basePrice.
  let price = basePrice;
  const driftPull = 0.02; // mean-reversion strength

  for (let i = count - 1; i >= 0; i--) {
    const time = lastBarTime - i * barSec;
    const open = price;
    const noise = normalSample(rand) * volatility * price;
    const pull = (basePrice - price) * driftPull;
    const close = open + noise + pull;
    const range = Math.abs(noise) + Math.abs(pull) + volatility * price * 0.4;
    const high = Math.max(open, close) + rand() * range * 0.5;
    const low = Math.min(open, close) - rand() * range * 0.5;
    candles.push({
      time,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
    });
    price = close;
  }

  // Force last close to *exactly* basePrice so the chart's headline number
  // matches the holding's current_price on first render — looks cleaner.
  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = round(basePrice);
    last.high = Math.max(last.high, last.close);
    last.low = Math.min(last.low, last.close);
  }
  return candles;
}

/** Step forward from the last candle, generating the next bar. Live ticks. */
export function generateNextCandle(
  prev: Candle,
  volatility: number = 0.0035,
  barSec: number = 60,
): Candle {
  const open = prev.close;
  // Use Math.random here (not seeded) — we want true variance on each tick
  // so consecutive reloads don't show identical "future" candles.
  const u1 = Math.max(Math.random(), 1e-9);
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const close = open + z * volatility * open;
  const wick = volatility * open * 0.5;
  const high = Math.max(open, close) + Math.random() * wick;
  const low = Math.min(open, close) - Math.random() * wick;
  return {
    time: prev.time + barSec,
    open: round(open),
    high: round(high),
    low: round(low),
    close: round(Math.max(close, 0.01)),
  };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
