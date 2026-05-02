'use client';

/* Mutual fund helpers (frontend).
 *
 * Mutual funds:
 *   • Don't trade intraday — they price once daily at 4pm ET (NAV).
 *   • Have expense ratios that compound silently.
 *   • Often overlap heavily with other funds & ETFs the user owns.
 *
 * The whole UI needs to behave correctly when a holding is a mutual fund:
 * no fake live ticking, "NAV updates 4pm ET" copy, and surfaced expense
 * ratios. This file is the single source of truth for "is this a fund?"
 * and for resolving fund metadata (curated → API fallback).
 */

import type { FundMetadata, Holding } from './api';
import { api } from './api';

// --- detection ---------------------------------------------------------

/** Mutual fund tickers on US exchanges are usually 5 alpha chars ending in
 * 'X'. Not perfect, but combined with the curated set + asset_class hint
 * it's accurate enough to drive UI decisions. */
const MUTUAL_FUND_RE = /^[A-Z]{4,5}X$/;

/** Tickers we have curated as mutual funds. Kept in sync with
 *  data/curated_funds.json. Adding a fund to either should be reflected
 *  in the other.
 */
const CURATED_MUTUAL_FUND_TICKERS = new Set<string>([
  'VTSAX', 'VFIAX', 'FXAIX', 'FZROX', 'FCNTX', 'FBGRX',
  'VTIAX', 'VBTLX', 'VMFXX', 'VFFVX', 'VTHRX', 'AGTHX',
  'PRGFX', 'SWPPX',
]);

/** ETFs we have curated metadata for — useful for the fund-detail dialog
 *  and overlap analysis (ETFs and mutual funds have the same problems).
 */
const CURATED_ETF_TICKERS = new Set<string>(['VTI', 'VOO', 'BND', 'VXUS']);

export function isMutualFund(
  tickerOrHolding: string | Holding | null | undefined,
  assetClass?: string | null,
): boolean {
  if (!tickerOrHolding) return false;

  let ticker: string;
  let ac: string | null | undefined = assetClass;
  if (typeof tickerOrHolding === 'string') {
    ticker = tickerOrHolding;
  } else {
    ticker = tickerOrHolding.ticker;
    ac = tickerOrHolding.asset_class ?? assetClass;
    if (tickerOrHolding.is_mutual_fund) return true;
  }

  const upper = ticker.toUpperCase();
  if (CURATED_MUTUAL_FUND_TICKERS.has(upper)) return true;
  if (ac === 'mutual_fund' || ac === 'money_market') return true;
  return MUTUAL_FUND_RE.test(upper);
}

/** Has curated metadata for this ticker (mutual fund OR ETF). Used for
 *  enabling the "What's inside" panel even on ETFs that share the
 *  composition / overlap problems. */
export function hasFundData(ticker: string | null | undefined): boolean {
  if (!ticker) return false;
  const upper = ticker.toUpperCase();
  return (
    CURATED_MUTUAL_FUND_TICKERS.has(upper) ||
    CURATED_ETF_TICKERS.has(upper) ||
    MUTUAL_FUND_RE.test(upper)
  );
}

// --- formatting --------------------------------------------------------

export function formatExpenseRatio(er: number | null | undefined): string {
  if (er == null || !isFinite(er)) return '—';
  // ER is decimal: 0.0004 → 0.04%
  const pct = er * 100;
  if (pct >= 0.5) return `${pct.toFixed(2)}%`;
  if (pct >= 0.05) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(3)}%`;
}

export function formatBps(er: number | null | undefined): string {
  if (er == null || !isFinite(er)) return '—';
  return `${Math.round(er * 10000)} bps`;
}

/** Turn 0.7321 into "73%" — used everywhere in overlap UI. */
export function formatOverlap(overlap: number): string {
  return `${Math.round(overlap * 100)}%`;
}

// --- metadata cache ----------------------------------------------------

const cache = new Map<string, Promise<FundMetadata>>();

export function fundMetadata(ticker: string): Promise<FundMetadata> {
  const key = ticker.toUpperCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const p = api.funds.metadata(key).catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, p);
  return p;
}

// --- daily NAV "history" line for charts ------------------------------

/** Generates a 90-day NAV history line for a mutual fund. Funds publish
 *  one price per day (NAV) so the line *does not tick*.
 *
 *  Volatility is picked from the strongest signal available:
 *    1. Money-market tickers (VMFXX, *XX) → completely flat at $1.00
 *    2. Cash asset class → completely flat
 *    3. Explicit category string ("bond", "international", "growth", …)
 *    4. Asset class hint ("bonds" → low, "intl_stocks" → moderate, etc.)
 *    5. Default ~1% daily sigma
 *
 *  Uses YYYY-MM-DD time strings for lightweight-charts.
 */
export function navHistory(
  ticker: string,
  category: string | null | undefined,
  basePrice: number,
  days = 90,
  assetClass: string | null | undefined = null,
): { time: string; value: number }[] {
  const seed = stringSeed(ticker);
  let rng = seed;

  // Money market & cash are locked at $1.00 (or basePrice if seeded
  // differently). They legitimately don't move, and in the previous
  // code they were getting equity-class volatility because no category
  // was being passed in — that produced a chart of VMFXX swinging from
  // $1.00 to $1.25, which is just wrong for a money-market fund.
  const isMoneyMarket =
    /^[A-Z]{2,5}XX$/.test(ticker.toUpperCase()) ||
    assetClass === 'cash' ||
    /money\s*market/i.test(category || '');

  const out: { time: string; value: number }[] = [];
  const today = new Date();
  if (isMoneyMarket) {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      out.push({ time: ymd(d), value: basePrice });
    }
    return out;
  }

  const sigma = volatilityForCategory(category) || volatilityForAssetClass(assetClass);

  let v = Math.max(basePrice, 1);
  // Walk backwards from today, then reverse — so today's value matches
  // the input basePrice exactly.
  const reversed: { time: string; value: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    reversed.push({ time: ymd(d), value: v });
    rng = mulberry32(rng);
    const r = boxMuller(rng / 0xffffffff);
    v = v * (1 - r * sigma);
    if (v <= 0.01) v = basePrice;
  }
  for (let i = reversed.length - 1; i >= 0; i--) out.push(reversed[i]);
  return out;
}

function volatilityForAssetClass(ac: string | null | undefined): number {
  switch (ac) {
    case 'cash':
      return 0;
    case 'bonds':
      return 0.003;
    case 'intl_stocks':
      return 0.011;
    case 'us_stocks':
      return 0.01;
    case 'real_estate':
      return 0.012;
    case 'commodities':
      return 0.018;
    default:
      return 0.01;
  }
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function volatilityForCategory(category: string | null | undefined): number {
  const c = (category || '').toLowerCase();
  if (c.includes('money market')) return 0.0001;
  if (c.includes('bond')) return 0.0025;
  if (c.includes('international')) return 0.011;
  if (c.includes('growth')) return 0.014;
  return 0.01;
}

function stringSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0);
}

function boxMuller(u: number): number {
  // Standard normal from one uniform — good enough for demo random walks.
  const u1 = Math.max(u, 1e-9);
  const u2 = (u + 0.37) % 1;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
