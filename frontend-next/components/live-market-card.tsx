'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CandlestickChart,
  Clock,
  LineChart as LineChartIcon,
  Pause,
  Play,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { MarketChart } from '@/components/market-chart';
import { TickerLogo } from '@/components/ticker-logo';
import {
  fmtMoney,
  fmtPct,
  holdingColorMap,
  relativeTime,
} from '@/lib/format';
import { useLivePrices } from '@/lib/live-prices';
import { useChartMode } from '@/lib/chart-mode';
import { isMutualFund } from '@/lib/funds';
import { periodStartPriceFor } from '@/lib/market-data';
import {
  effectiveHoldingPrice,
  effectiveHoldingValue,
} from '@/lib/holding-quote';
import type { Holding } from '@/lib/api';

function livePxFromMap(
  map: Record<string, number>,
  ticker: string,
  fallback: number,
): number {
  if (!ticker) return fallback;
  return (
    map[ticker] ??
    map[ticker.toUpperCase()] ??
    map[ticker.toLowerCase()] ??
    fallback
  );
}

interface Props {
  holdings: Holding[];
  /** Optional: set the ticker that should be selected on first render. */
  initialTicker?: string;
}

/** Period selector configuration.
 *
 *  Each entry controls how the chart is seeded:
 *    bars    — number of historical bars to draw on first render
 *    barSec  — seconds per bar; also the tick advance, so live ticks
 *              naturally fall on the same time grid as the history.
 *
 *  Live ticks fire every 2s regardless of period — for short periods
 *  that's an intraday-feel; for longer periods each "day" of fake history
 *  zips by every 2s, which keeps the demo lively across the board. */
type LivePeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';
type FundPeriod = '1M' | '3M' | '6M' | '1Y' | '5Y';

const PERIOD_CONFIG: Record<LivePeriod, { bars: number; barSec: number }> = {
  '1D': { bars: 180, barSec: 60 },        // 1-min bars, ~3h history
  '1W': { bars: 168, barSec: 600 },       // 10-min bars, ~28h
  '1M': { bars: 168, barSec: 3600 },      // 1-hour bars, ~7d
  '3M': { bars: 90, barSec: 86400 },      // daily bars, ~3mo
  '6M': { bars: 130, barSec: 86400 },     // daily bars, ~6mo
  '1Y': { bars: 252, barSec: 86400 },     // daily bars, ~1y
};

const PERIOD_KEYS: LivePeriod[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

/** Mutual funds price once per day, so every period shares barSec=86400
 *  (1 daily bar) and only the lookback length changes. We expose periods
 *  brokers actually offer for fund pages. */
const FUND_PERIOD_CONFIG: Record<FundPeriod, { bars: number; barSec: number }> = {
  '1M': { bars: 21, barSec: 86400 },     // ~1 trading month
  '3M': { bars: 63, barSec: 86400 },
  '6M': { bars: 126, barSec: 86400 },
  '1Y': { bars: 252, barSec: 86400 },
  '5Y': { bars: 1260, barSec: 86400 },   // ~5 trading years
};

const FUND_PERIOD_KEYS: FundPeriod[] = ['1M', '3M', '6M', '1Y', '5Y'];

/** Money-market funds (VMFXX, SPAXX, …) sit at a constant $1.00 NAV by
 *  design — they're cash-equivalent. Detecting them is mostly so we can
 *  render clearer copy ("Money market — held at $1.00") and disable the
 *  candle toggle. The pattern catches the SEC-mandated XX suffix used
 *  by every major US money-market fund. */
function isMoneyMarketFund(holding: { ticker: string; asset_class?: string | null }): boolean {
  if (holding.asset_class === 'cash') return true;
  return /^[A-Z]{3,4}XX$/.test((holding.ticker || '').toUpperCase());
}

/**
 * Live Market hero card for the Investment tab.
 *
 *  • Top: row of selectable holdings (logo + ticker + live price + change)
 *  • Period selector (1D / 1W / 1M / 3M / 6M / 1Y) above the chart
 *  • Body: a 320-tall lightweight-charts pane that ticks every 2 seconds
 *  • Bottom: tiny "LIVE · last tick Xs ago" indicator + pause toggle
 *
 * Picking a ticker switches the chart but DOESN'T stop the other tickers'
 * live state — every holding keeps its last-known live price in the global
 * store, so portfolio value / P&L on the rest of the page stays in sync.
 */
export function LiveMarketCard({ holdings, initialTicker }: Props) {
  const [period, setPeriod] = useState<LivePeriod>('1D');
  const [fundPeriod, setFundPeriod] = useState<FundPeriod>('3M');

  /** Coerce zero/missing `current_price` using value/shares or cost basis
   *  so a fresh buy (e.g. META) still appears in the pill row + chart. */
  const listings = useMemo(
    () =>
      holdings.map((h) => {
        const cp = Number(h.current_price ?? 0);
        if (cp > 0) return h;
        const eff = effectiveHoldingPrice(h);
        if (eff <= 0) return h;
        const sh = Number(h.shares ?? 0);
        return {
          ...h,
          current_price: eff,
          current_value:
            sh > 0 ? sh * eff : Number(h.current_value ?? 0),
        };
      }),
    [holdings],
  );

  const eligible = useMemo(
    () =>
      listings
        .filter(
          (h) =>
            Number(h.shares ?? 0) > 0 && effectiveHoldingPrice(h) > 0,
        )
        .sort(
          (a, b) =>
            effectiveHoldingValue(b) - effectiveHoldingValue(a),
        ),
    [listings],
  );

  const [active, setActive] = useState<string>(
    initialTicker ?? eligible[0]?.ticker ?? '',
  );

  // Reset selection if holdings change underneath us.
  useEffect(() => {
    if (!eligible.find((h) => h.ticker === active)) {
      setActive(eligible[0]?.ticker ?? '');
    }
  }, [eligible, active]);

  const colorMap = useMemo(() => holdingColorMap(holdings), [holdings]);
  const { prices, isLive, setIsLive, lastTickAt } = useLivePrices();
  const { kind: chartKind, setKind: setChartKind } = useChartMode();

  const activeHolding = eligible.find((h) => h.ticker === active);

  // ────────────────────────────────────────────────────────────────────
  // Period-aware anchor + change calculation (the brokerage way)
  // ────────────────────────────────────────────────────────────────────
  // Brokerages display "% change since the start of the displayed period"
  // — matching what the chart visually shows. We replicate that by:
  //   1. Capturing a *stable* anchor price per (ticker, period) the first
  //      time we observe it. This stops the chart's basePrice prop from
  //      changing on every live tick (which would remount the chart
  //      every 2 seconds — disastrous).
  //   2. Re-running the same deterministic generateSyntheticHistory
  //      generator the chart uses, with the same inputs, to read off
  //      the *period start* — i.e. the open of the leftmost bar.
  //   3. Computing dollar / pct change as `livePrice - periodStart`.
  //
  // Result: % matches what the chart visually shows. Switching periods
  // re-anchors and the % updates instantly. Live ticks keep moving the
  // numerator while the denominator stays put.
  const anchorRef = useRef<
    Record<string, { period: LivePeriod; price: number }>
  >({});

  const getAnchor = (ticker: string, currentPrice: number): number => {
    const cached = anchorRef.current[ticker];
    if (cached?.period === period && cached.price > 0) return cached.price;
    if (currentPrice > 0) {
      anchorRef.current[ticker] = { period, price: currentPrice };
      return currentPrice;
    }
    return cached?.price ?? 0;
  };

  /** Returns {periodStart, dollar, pct} for the given ticker against the
   *  active period. periodStart is computed from the same deterministic
   *  formula MarketChart's history generator uses for its leftmost bar
   *  (periodStartPriceFor), so the displayed % matches what the chart
   *  visually shows. Live ticks move `currentPrice`; periodStart is
   *  fixed to the (ticker, period, anchor) triple, so the % updates
   *  in real time as ticks arrive. */
  const computeChange = (
    ticker: string,
    currentPrice: number,
    assetClass: string | null | undefined,
  ): { periodStart: number; dollar: number; pct: number } => {
    if (currentPrice <= 0) {
      return { periodStart: 0, dollar: 0, pct: 0 };
    }
    // Cash / money-market is locked at $1.00 — change is always 0%.
    if (assetClass === 'cash') {
      return { periodStart: currentPrice, dollar: 0, pct: 0 };
    }
    const anchor = getAnchor(ticker, currentPrice);
    if (anchor <= 0) return { periodStart: 0, dollar: 0, pct: 0 };
    // Mutual funds use the FUND_PERIOD_CONFIG (daily bars at varying
    // lookback lengths) so the displayed trend window matches what
    // the chart shows. Stocks / ETFs use the live PERIOD_CONFIG.
    const isFund = isMutualFund(ticker, assetClass ?? null);
    const cfg = isFund
      ? FUND_PERIOD_CONFIG[fundPeriod]
      : PERIOD_CONFIG[period];
    const periodStart = periodStartPriceFor(
      ticker,
      anchor,
      cfg.bars,
      cfg.barSec,
    );
    if (periodStart <= 0) {
      return { periodStart: 0, dollar: 0, pct: 0 };
    }
    const dollar = currentPrice - periodStart;
    const pct = (dollar / periodStart) * 100;
    return { periodStart, dollar, pct };
  };

  if (eligible.length === 0 || !activeHolding) {
    return null;
  }

  const apiPrice = Number(activeHolding.current_price ?? 0);
  const livePrice = livePxFromMap(prices, active, apiPrice);

  const accent = colorMap[active] ?? '#6366F1';
  const isFund = isMutualFund(activeHolding);
  const isCash = activeHolding.asset_class === 'cash';
  const isMoneyMarket = isMoneyMarketFund(activeHolding);
  // Only money-market / cash is genuinely locked to line — its NAV
  // is fixed at $1.00 so candle bars would be 1px tall and convey no
  // information. Regular mutual funds (VFIAX, FXAIX, FCNTX, etc.) now
  // support candle view: MarketChart synthesises daily OHLC from the
  // same trended generator stocks use.
  const lockedToLine = isCash;

  // Stable anchor for the active ticker — also passed to MarketChart as
  // basePrice so the chart only remounts when (ticker, period, kind)
  // changes, never per-tick.
  const activeAnchor = isFund
    ? livePrice // funds: chart is daily-NAV mode, anchor doesn't matter
    : getAnchor(active, livePrice);

  const { periodStart, dollar: dollarChange, pct: pctChange } =
    computeChange(active, livePrice, activeHolding.asset_class);
  const positive = dollarChange >= 0;

  /** Performance line uses the same type scale + colors as stocks.
   *  Money-market funds stay indigo + clock (informational); other
   *  mutual funds use emerald/rose + trending icons like equities so
   *  the % change doesn't look like a different typeface. */
  const perfToneClass = isMoneyMarket
    ? 'text-indigo-700'
    : positive
      ? 'text-emerald-600'
      : 'text-rose-500';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header — ticker selector */}
      <div className="px-5 lg:px-6 pt-5 pb-3 border-b border-gray-50">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-sm leading-tight">
                {isMoneyMarket
                  ? 'Money Market'
                  : isFund
                    ? 'Daily NAV'
                    : 'Live Market'}
              </h2>
              <p className="text-[11px] text-gray-500">
                {isMoneyMarket
                  ? 'Cash-equivalent fund — held at a steady $1.00 by design'
                  : isFund
                    ? 'Mutual funds price once per day at 4:00 PM ET'
                    : 'Simulated tick every 2s · powers your live P&L'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Global candle/line switch — flips every MarketChart in the
                app at once (the choice persists to localStorage). Only
                cash / money-market is genuinely locked to line; regular
                mutual funds get a daily-OHLC candle view. */}
            <ChartKindToggle
              kind={chartKind}
              onChange={setChartKind}
              disabled={lockedToLine}
              disabledHint={
                isMoneyMarket
                  ? 'Money market funds hold steady at $1.00 NAV — there are no candles to draw'
                  : 'Chart style is locked for this asset'
              }
            />

            {isFund ? (
              <span
                className={`text-[11px] flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium border ${
                  isMoneyMarket
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-indigo-700 bg-indigo-50 border-indigo-100'
                }`}
                title={
                  isMoneyMarket
                    ? 'Money market funds invest in short-term cash equivalents — they keep their NAV at $1.00 and pay yield through interest, not price appreciation.'
                    : 'Mutual funds publish a single NAV price per day after the market closes.'
                }
              >
                <Clock className="w-3 h-3" />
                {isMoneyMarket ? '$1.00 NAV — fixed' : 'NAV — daily'}
              </span>
            ) : (
              <>
                <span className="text-[11px] flex items-center gap-1.5 text-gray-500">
                  <span className="relative flex w-2 h-2">
                    {isLive && (
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
                    )}
                    <span
                      className={`relative inline-flex w-2 h-2 rounded-full ${
                        isLive ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    />
                  </span>
                  {isLive ? 'LIVE' : 'PAUSED'}
                  {lastTickAt && (
                    <span className="text-gray-400">
                      · {relativeTime(new Date(lastTickAt).toISOString())}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => setIsLive(!isLive)}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition"
                >
                  {isLive ? (
                    <>
                      <Pause className="w-3 h-3" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" /> Resume
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Ticker pill row — every holding with a price (scroll when many) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {eligible.map((h) => {
            const apiP = Number(h.current_price ?? 0);
            const live = livePxFromMap(prices, h.ticker, apiP);
            // Same period-start logic as the active chart, applied per-pill.
            // For mutual funds / cash this returns 0% which matches their
            // NAV-only / flat behaviour.
            const { pct: ch } = computeChange(h.ticker, live, h.asset_class);
            const isActive = h.ticker === active;
            const c = colorMap[h.ticker] ?? '#6366F1';
            return (
              <button
                key={h.ticker}
                onClick={() => setActive(h.ticker)}
                className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl border transition ${
                  isActive
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/60'
                }`}
                aria-pressed={isActive}
              >
                <TickerLogo
                  ticker={h.ticker}
                  color={c}
                  size="xs"
                  rounded="md"
                />
                <div className="text-left">
                  <p className="text-xs font-semibold leading-tight">
                    {h.ticker}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 leading-tight">
                    <span className="tabular-nums">{fmtMoney(live)}</span>
                    <span
                      className={`tabular-nums font-medium ${
                        ch >= 0 ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {fmtPct(ch, { withSign: true, decimals: 2 })}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 lg:px-6 pt-5 pb-6">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <TickerLogo
              ticker={active}
              color={accent}
              size="lg"
              rounded="lg"
            />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{activeHolding.name}</p>
              <p className="text-2xl font-bold tabular-nums">
                {fmtMoney(livePrice)}
              </p>
              <p
                className={`text-xs font-semibold flex items-center gap-1 tabular-nums ${perfToneClass}`}
              >
                {isMoneyMarket ? (
                  <Clock className="w-3 h-3 shrink-0" />
                ) : positive ? (
                  <TrendingUp className="w-3 h-3 shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 shrink-0" />
                )}
                {isMoneyMarket ? (
                  <>Held at $1.00 NAV · earns yield through interest</>
                ) : isFund ? (
                  <>
                    {positive ? '+' : '−'}
                    {fmtMoney(Math.abs(dollarChange))} (
                    {fmtPct(Math.abs(pctChange), { decimals: 2 })}) over{' '}
                    {fundPeriod}
                  </>
                ) : (
                  <>
                    {positive ? '+' : '−'}
                    {fmtMoney(Math.abs(dollarChange))} (
                    {fmtPct(Math.abs(pctChange), { decimals: 2 })}){' '}
                    {period === '1D' ? 'since open' : `over ${period}`}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="text-right text-[11px] text-gray-500">
            <p>
              You hold{' '}
              <span className="text-gray-900 font-semibold tabular-nums">
                {Number(activeHolding.shares ?? 0).toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                })}
              </span>{' '}
              shares
            </p>
            <p className="mt-0.5">
              Position value{' '}
              <span className="text-gray-900 font-semibold tabular-nums">
                {fmtMoney(livePrice * Number(activeHolding.shares ?? 0))}
              </span>
            </p>
          </div>
        </div>

        {/* Period selector — every chart gets one. For live tickers it
            sets the intraday/daily resolution; for mutual funds it picks
            the NAV-history lookback window. Money market is locked to
            a flat line either way, but we still show the selector so
            the UI stays consistent. */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">
            Timeline
          </p>
          {isFund ? (
            <div
              role="tablist"
              aria-label="NAV history period"
              className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5"
            >
              {FUND_PERIOD_KEYS.map((p) => {
                const isOn = p === fundPeriod;
                return (
                  <button
                    key={p}
                    role="tab"
                    aria-selected={isOn}
                    onClick={() => setFundPeriod(p)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition tabular-nums ${
                      isOn
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              role="tablist"
              aria-label="Live market period"
              className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5"
            >
              {PERIOD_KEYS.map((p) => {
                const isOn = p === period;
                return (
                  <button
                    key={p}
                    role="tab"
                    aria-selected={isOn}
                    onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition tabular-nums ${
                      isOn
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* The chart itself — keyed by ticker + mode + period so a new
            MarketChart instance mounts cleanly when the user switches
            selection, toggles live/NAV mode, or changes the timeline.
            We anchor basePrice to the live price so the seeded history
            mean-reverts to the current quote, keeping period transitions
            visually continuous. resetBase(ticker) inside MarketChart then
            re-anchors "since open" to the next live tick. */}
        {/* The chart's render kind comes from the global ChartModeProvider
            unless it's a mutual fund / cash holding (forced line by the
            chart itself). Period changes still fully remount via the key
            so the seeded history regenerates at the new resolution.

            basePrice is the *stable* per-(ticker,period) anchor — passing
            livePrice here would change every 2s and remount the chart on
            every tick, which would obliterate the live ticking effect. */}
        <MarketChart
          key={`${active}-${isFund ? 'nav' : 'live'}-${
            isFund ? fundPeriod : period
          }-${chartKind}`}
          ticker={active}
          basePrice={activeAnchor}
          assetClass={activeHolding.asset_class}
          color={accent}
          mode={isFund ? 'daily-nav' : 'live'}
          height={300}
          intervalMs={2000}
          historyBars={
            isFund
              ? FUND_PERIOD_CONFIG[fundPeriod].bars
              : PERIOD_CONFIG[period].bars
          }
          barSec={
            isFund
              ? FUND_PERIOD_CONFIG[fundPeriod].barSec
              : PERIOD_CONFIG[period].barSec
          }
        />

        <p className="text-[10px] text-gray-400 mt-3 text-center">
          {isMoneyMarket
            ? 'Money market funds invest in short-term cash equivalents (T-bills, repos, commercial paper). They keep their NAV pegged at $1.00 and pay yield through monthly interest distributions — not price changes.'
            : isFund
              ? `${fundPeriod} of daily NAV history. Mutual funds publish one price per day after the market closes — no intraday ticking.`
              : 'Movement is simulated from a random walk seeded by the ticker so the demo runs 24/7. Your live P&L on this page updates from these ticks too.'}
        </p>
      </div>
    </div>
  );
}

/**
 * Two-button pill toggle for the global chart-style preference.
 *
 * Brokerages render this kind of control inline above the chart, paired
 * with the period selector. Visible always — even when locked to line —
 * so users learn the toggle exists. When `disabled`, the buttons render
 * inert with a tooltip explaining why.
 */
function ChartKindToggle({
  kind,
  onChange,
  disabled,
  disabledHint,
}: {
  kind: 'candle' | 'line';
  onChange: (k: 'candle' | 'line') => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const baseTitle = disabled
    ? disabledHint ?? 'Chart style is locked for this asset'
    : 'Chart style — applies to every chart in the app';

  return (
    <div
      role="tablist"
      aria-label="Chart style"
      title={baseTitle}
      className={`inline-flex items-center gap-0.5 rounded-full p-0.5 border transition ${
        disabled
          ? 'bg-gray-50 border-gray-100 opacity-60'
          : 'bg-gray-100 border-transparent'
      }`}
    >
      {(
        [
          { id: 'candle', icon: CandlestickChart, label: 'Candle' },
          { id: 'line', icon: LineChartIcon, label: 'Line' },
        ] as const
      ).map(({ id, icon: Icon, label }) => {
        const isOn = kind === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isOn}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full transition ${
              isOn
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Icon className="w-3 h-3" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
