/**
 * Synthetic OHLC generator used by MarketChart.
 *
 * Why synthetic instead of pulling from Polygon/yfinance every page-load?
 *   - Demo runs 24/7 — markets are closed on weekends, after-hours, etc.
 *   - Free-tier rate limits would crater the demo with 6 holdings ticking.
 *   - Real-feeling movement is enough for a hackathon visual; users
 *     don't actually trade off these prices.
 *
 * Each ticker gets a deterministic per-period "trend" (e.g. MSFT is up
 * 18% over 1Y, AAPL is up 22% over 3M, NVDA is up 41% over 1Y) so the
 * leftmost bar of every chart sits at a meaningfully different price
 * from the rightmost — exactly like what every real brokerage chart
 * shows. The walk between is a noisy linear interpolation toward the
 * end-of-period basePrice, so live ticks pick up smoothly from the
 * right edge.
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

/** Approximate "how much should this ticker have moved over a period of
 *  `count` × `barSec` seconds?" — deterministic per (ticker, count, barSec)
 *  so reloading the page doesn't re-roll the trend. Biased ~60% positive
 *  to mimic the real long-run upward drift of equity markets.
 *
 *  Magnitude scales with horizon (1D = ~±1%, 1M = ~±6%, 1Y = ~±25%) so
 *  a 1Y chart shows a meaningful trend, while a 1D chart still feels
 *  intraday and shouldn't bake in a year's worth of return. */
export function periodReturnFor(
  ticker: string,
  count: number,
  barSec: number,
): number {
  if (count <= 0 || barSec <= 0) return 0;
  const totalSec = count * barSec;
  let scale: number;
  if (totalSec < 24 * 3600) scale = 0.012; // 1D: ±~1.2%
  else if (totalSec < 7 * 86400) scale = 0.03; // 1W: ±~3%
  else if (totalSec < 30 * 86400) scale = 0.06; // 1M: ±~6%
  else if (totalSec < 90 * 86400) scale = 0.11; // 3M: ±~11%
  else if (totalSec < 200 * 86400) scale = 0.17; // 6M: ±~17%
  else scale = 0.26; // 1Y+: ±~26%

  // Hash on (ticker + count + barSec) so different periods of the same
  // ticker get distinct trends — otherwise switching 1M → 1Y would just
  // replay the same number scaled.
  const rand = mulberry32(
    hashString(`${ticker}|return|${count}|${barSec}`),
  );
  // Range biased upward: ~ -0.45*scale to +1.0*scale so most stocks are
  // gainers but realistic losers exist too.
  return scale * (rand() * 1.45 - 0.45);
}

/** Cheap lookup: what price does the leftmost bar open at, for the
 *  given anchor (= rightmost basePrice)? Used by chart percent-change
 *  displays so they don't have to regenerate the whole history. */
export function periodStartPriceFor(
  ticker: string,
  basePrice: number,
  count: number,
  barSec: number,
): number {
  if (basePrice <= 0) return 0;
  const ret = periodReturnFor(ticker, count, barSec);
  return basePrice / (1 + ret);
}

/** Initial history: returns `count` candles ending "now", with timestamps
 *  every `barSec` seconds. The walk is seeded from the ticker so the
 *  rendered series looks identical across reloads.
 *
 *  Shape:
 *    - leftmost bar opens at `periodStartPriceFor(...)` so the chart has
 *      a clear directional trend matching what a brokerage would show
 *    - rightmost bar closes at exactly `basePrice` so live ticks pick
 *      up cleanly without a jump
 *    - candles in between are a noisy walk pulled toward the linear
 *      trend line connecting the two endpoints */
export function generateSyntheticHistory(
  ticker: string,
  basePrice: number,
  count: number = 180,
  volatility: number = 0.0035,
  barSec: number = 60,
): Candle[] {
  if (basePrice <= 0 || count <= 0) return [];

  const rand = mulberry32(hashString(ticker || 'X'));
  const nowSec = Math.floor(Date.now() / 1000);
  // Snap to bar boundary so chart axis ticks stay clean.
  const lastBarTime = nowSec - (nowSec % barSec);

  const startPrice = periodStartPriceFor(ticker, basePrice, count, barSec);
  const candles: Candle[] = [];
  let price = startPrice;
  // Light per-bar pull toward the linear trend line — keeps the walk
  // wandering visibly in the middle without ever drifting so far that
  // the trend is obscured.
  const trendPull = 0.06;

  for (let i = 0; i < count; i++) {
    const progress = count === 1 ? 1 : i / (count - 1);
    const trendTarget = startPrice + (basePrice - startPrice) * progress;
    const open = price;
    const noise = normalSample(rand) * volatility * price;
    const pull = (trendTarget - price) * trendPull;
    const close = open + noise + pull;
    const range =
      Math.abs(noise) + Math.abs(pull) + volatility * price * 0.4;
    const high = Math.max(open, close) + rand() * range * 0.5;
    const low = Math.min(open, close) - rand() * range * 0.5;
    candles.push({
      time: lastBarTime - (count - 1 - i) * barSec,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
    });
    price = close;
  }

  // Force the endpoints to *exactly* the analytical values so the chart's
  // displayed range matches our percent-change math byte-for-byte.
  if (candles.length > 0) {
    const first = candles[0];
    first.open = round(startPrice);
    first.high = Math.max(first.high, first.open);
    first.low = Math.min(first.low, first.open);

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
