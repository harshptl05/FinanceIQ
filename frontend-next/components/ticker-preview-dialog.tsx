'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CandlestickChart,
  ExternalLink,
  LineChart as LineChartIcon,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MarketChart } from '@/components/market-chart';
import { TickerLogo } from '@/components/ticker-logo';
import { TradeDialog } from '@/components/trade-dialog';
import {
  api,
  type Holding,
  type SearchResult,
  type TradeAction,
} from '@/lib/api';
import { assetColor, assetLabel, fmtMoney, fmtPct } from '@/lib/format';
import { useLivePrices } from '@/lib/live-prices';
import { useChartMode } from '@/lib/chart-mode';
import { periodStartPriceFor } from '@/lib/market-data';

type LivePeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

const PERIOD_CONFIG: Record<LivePeriod, { bars: number; barSec: number }> = {
  '1D': { bars: 180, barSec: 60 },
  '1W': { bars: 168, barSec: 600 },
  '1M': { bars: 168, barSec: 3600 },
  '3M': { bars: 90, barSec: 86400 },
  '6M': { bars: 130, barSec: 86400 },
  '1Y': { bars: 252, barSec: 86400 },
};

const PERIOD_KEYS: LivePeriod[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The search result that was clicked. */
  result: SearchResult | null;
  /** Owned shares for this ticker (0 if discovery flow). */
  ownedHolding?: Holding | null;
  /** Called after a successful trade. */
  onTraded?: () => void | Promise<void>;
};

/**
 * Search-result preview: shows a live chart, key facts, and inline Buy/Sell.
 *
 * This is the "view chart + decide to trade" surface. Clicking Buy or Sell
 * opens the existing TradeDialog pre-filled for the chosen action — keeping
 * the actual trade form unified across the entire app.
 *
 * UX choices that match real brokerages (Robinhood / Fidelity / Schwab):
 *   • Period selector + chart mode toggle visible above the chart.
 *   • "% over period" headline computed from the same generator the chart
 *     uses, so the % matches what the user actually sees on screen.
 *   • Owned-position panel (shares + position value + P&L) appears the
 *     moment the ticker is in the user's portfolio.
 *   • Mutual funds get a distinct "Last NAV — next update at 4 PM ET"
 *     caption + their chart locks to a daily-NAV line series.
 */
export function TickerPreviewDialog({
  open,
  onOpenChange,
  result,
  ownedHolding,
  onTraded,
}: Props) {
  const [period, setPeriod] = useState<LivePeriod>('1D');
  const { kind: chartKind, setKind: setChartKind } = useChartMode();
  const { prices } = useLivePrices();
  const [tradeAction, setTradeAction] = useState<TradeAction | null>(null);
  // Optional richer quote we lazy-load so previews always show a price.
  const [hydrated, setHydrated] = useState<SearchResult | null>(null);
  const [hydrating, setHydrating] = useState(false);

  // Reset per-ticker state when the dialog (re-)opens for a new ticker.
  useEffect(() => {
    if (!open || !result) return;
    setPeriod('1D');
    setHydrated(null);
    setTradeAction(null);

    // If the search result didn't include a price (only the top result
    // does), fetch the full quote in the background so the chart has a
    // sensible anchor and the headline price isn't blank.
    const needsHydration = !result.current_price || result.current_price <= 0;
    if (!needsHydration) return;
    let cancelled = false;
    (async () => {
      setHydrating(true);
      try {
        const full = await api.search.quote(result.ticker);
        if (!cancelled) setHydrated(full);
      } catch {
        /* keep the un-hydrated result; chart will still render at 0 */
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, result]);

  // Stable per-(ticker, period) anchor — same trick as LiveMarketCard. Lets
  // us pass a non-ticking basePrice to MarketChart and re-derive the period
  // start from the same deterministic generator the chart uses.
  const anchorRef = useRef<
    Record<string, { period: LivePeriod; price: number }>
  >({});

  const fullResult = hydrated ?? result;
  const ticker = fullResult?.ticker ?? '';
  const livePrice = ticker
    ? prices[ticker] ?? Number(fullResult?.current_price ?? 0)
    : 0;

  const isFund = !!fullResult?.is_mutual_fund;
  const isCash = fullResult?.asset_class === 'cash';
  // Only money-market / cash is genuinely locked to line — funds get
  // a daily-OHLC candle view via MarketChart's daily-nav candle path.
  const lockedToLine = isCash;
  const color = fullResult ? assetColor(fullResult.asset_class) : '#6366F1';

  const getAnchor = (
    tickerKey: string,
    currentPrice: number,
  ): number => {
    const cached = anchorRef.current[tickerKey];
    if (cached?.period === period && cached.price > 0) return cached.price;
    if (currentPrice > 0) {
      anchorRef.current[tickerKey] = { period, price: currentPrice };
      return currentPrice;
    }
    return cached?.price ?? 0;
  };

  const { dollarChange, pctChange, anchor } = useMemo(() => {
    if (!fullResult || livePrice <= 0) {
      return { dollarChange: 0, pctChange: 0, anchor: 0 };
    }
    if (lockedToLine) {
      return { dollarChange: 0, pctChange: 0, anchor: livePrice };
    }
    const a = getAnchor(fullResult.ticker, livePrice);
    if (a <= 0) return { dollarChange: 0, pctChange: 0, anchor: 0 };
    const cfg = PERIOD_CONFIG[period];
    // Same deterministic formula MarketChart uses for its leftmost bar,
    // so the displayed % aligns 1:1 with what the chart visually shows.
    const periodStart = periodStartPriceFor(
      fullResult.ticker,
      a,
      cfg.bars,
      cfg.barSec,
    );
    if (periodStart <= 0) {
      return { dollarChange: 0, pctChange: 0, anchor: a };
    }
    const dollar = livePrice - periodStart;
    const pct = (dollar / periodStart) * 100;
    return { dollarChange: dollar, pctChange: pct, anchor: a };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullResult, livePrice, period, lockedToLine]);

  // Owned position math
  const ownedShares = Number(ownedHolding?.shares ?? 0);
  const ownedCost = Number(ownedHolding?.avg_cost_basis ?? 0);
  const ownedValue = ownedShares * livePrice;
  const ownedUnrealized =
    ownedShares > 0 ? ownedValue - ownedShares * ownedCost : 0;
  const ownedUnrealizedPct =
    ownedCost > 0 ? ((livePrice - ownedCost) / ownedCost) * 100 : 0;

  if (!open || !fullResult) return null;

  const dayChange = Number(fullResult.day_change_pct ?? 0);
  const positive = dollarChange >= 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Custom close: padding-top on header clears it; Yahoo link uses mr-16 */}
        <DialogContent
          // sm: prefix required so we override the default sm:max-w-lg cap.
          className="sm:max-w-3xl p-0 gap-0 overflow-hidden"
          showCloseButton={false}
        >
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="absolute top-4 right-4 z-30 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-gray-500 border border-gray-200 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition focus:outline-hidden focus:ring-2 focus:ring-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogClose>
          <DialogHeader className="sr-only">
            <DialogTitle>
              {fullResult.ticker} – {fullResult.name}
            </DialogTitle>
          </DialogHeader>

          {/* Header — pt-10 leaves room for absolute close; pr avoids Yahoo vs X */}
          <div className="px-5 lg:px-6 pt-10 pb-3 border-b border-gray-100">
            <div className="flex items-start gap-3 flex-wrap pr-2 sm:pr-4">
              <TickerLogo
                ticker={fullResult.ticker}
                color={color}
                size="lg"
                rounded="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold tracking-tight">
                    {fullResult.ticker}
                  </h3>
                  {fullResult.is_mutual_fund && (
                    <span className="text-[9px] px-1.5 py-px rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold tracking-wider">
                      MF
                    </span>
                  )}
                  {(fullResult.quote_type ?? '').toLowerCase() === 'etf' && (
                    <span className="text-[9px] px-1.5 py-px rounded bg-sky-50 text-sky-700 border border-sky-100 font-semibold tracking-wider">
                      ETF
                    </span>
                  )}
                  {ownedShares > 0 && (
                    <span className="text-[9px] px-1.5 py-px rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold tracking-wider">
                      OWNED
                    </span>
                  )}
                  <a
                    href={`https://finance.yahoo.com/quote/${encodeURIComponent(
                      fullResult.ticker,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto mr-14 sm:mr-16 text-[11px] text-gray-400 hover:text-gray-600 inline-flex items-center gap-1"
                  >
                    Yahoo <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-sm text-gray-600 truncate">
                  {fullResult.name}
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] text-gray-500">
                  <span style={{ color }} className="font-medium">
                    {assetLabel(fullResult.asset_class)}
                  </span>
                  {fullResult.exchange && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{fullResult.exchange}</span>
                    </>
                  )}
                  {fullResult.sector && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{fullResult.sector}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Price + period change */}
            <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {livePrice > 0 ? fmtMoney(livePrice) : hydrating ? '…' : '—'}
                </p>
                {lockedToLine ? (
                  <p className="text-xs text-gray-500 mt-1">
                    {isFund
                      ? 'Last NAV — next update 4:00 PM ET'
                      : 'Cash · stable value'}
                  </p>
                ) : (
                  <p
                    className={`text-sm font-medium tabular-nums flex items-center gap-1 mt-1 ${
                      positive ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  >
                    {positive ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {positive ? '+' : ''}
                    {fmtMoney(dollarChange)} (
                    {fmtPct(pctChange, { withSign: true, decimals: 2 })}){' '}
                    <span className="text-gray-500 font-normal">
                      {period === '1D' ? 'since open' : `over ${period}`}
                    </span>
                  </p>
                )}
                {Math.abs(dayChange) > 0.005 && !lockedToLine && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Today: {fmtPct(dayChange, { withSign: true, decimals: 2 })}
                  </p>
                )}
              </div>

              {/* Chart kind toggle (hidden / disabled for funds & cash) */}
              {!lockedToLine && (
                <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-full p-0.5 self-start">
                  <button
                    onClick={() => setChartKind('candle')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                      chartKind === 'candle'
                        ? 'bg-white shadow text-gray-900'
                        : 'text-gray-500'
                    }`}
                    aria-pressed={chartKind === 'candle'}
                  >
                    <CandlestickChart className="w-3 h-3" /> Candle
                  </button>
                  <button
                    onClick={() => setChartKind('line')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                      chartKind === 'line'
                        ? 'bg-white shadow text-gray-900'
                        : 'text-gray-500'
                    }`}
                    aria-pressed={chartKind === 'line'}
                  >
                    <LineChartIcon className="w-3 h-3" /> Line
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Period selector + chart */}
          <div className="px-5 lg:px-6 pt-4 pb-2">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2">
              {PERIOD_KEYS.map((p) => {
                const active = p === period;
                return (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                      active
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            {livePrice > 0 ? (
              <MarketChart
                key={`${ticker}-${isFund ? 'nav' : 'live'}-${period}-${chartKind}`}
                ticker={ticker}
                basePrice={anchor || livePrice}
                assetClass={fullResult.asset_class}
                color={color}
                mode={isFund ? 'daily-nav' : 'live'}
                height={260}
                intervalMs={2000}
                historyBars={PERIOD_CONFIG[period].bars}
                barSec={PERIOD_CONFIG[period].barSec}
              />
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-gray-400">
                {hydrating
                  ? 'Loading price…'
                  : 'No live quote right now — try again in a moment.'}
              </div>
            )}
          </div>

          {/* Owned position panel — only when user already holds this ticker */}
          {ownedShares > 0 && (
            <div className="mx-5 lg:mx-6 mt-2 mb-1 p-3 rounded-xl border border-emerald-100 bg-emerald-50/40 flex items-center gap-4 flex-wrap text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                  Position
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {ownedShares.toLocaleString()} sh ·{' '}
                  {fmtMoney(ownedValue)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                  Avg cost
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {fmtMoney(ownedCost)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                  Unrealized
                </p>
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    ownedUnrealized >= 0 ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                >
                  {ownedUnrealized >= 0 ? '+' : ''}
                  {fmtMoney(ownedUnrealized)} (
                  {fmtPct(ownedUnrealizedPct, {
                    withSign: true,
                    decimals: 2,
                  })}
                  )
                </p>
              </div>
            </div>
          )}

          {/* Action row */}
          <div className="px-5 lg:px-6 py-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTradeAction('buy')}
              className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Buy {fullResult.ticker}
            </button>
            {ownedShares > 0 ? (
              <button
                onClick={() => setTradeAction('sell')}
                className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-300 text-gray-900 text-sm font-semibold hover:bg-gray-50 transition"
              >
                <ArrowUpFromLine className="w-4 h-4" />
                Sell
              </button>
            ) : (
              <p className="text-[11px] text-gray-400 px-1">
                You don&apos;t own this yet — buy to add it to your portfolio.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reuse the unified TradeDialog so the transaction logic is one place. */}
      {fullResult && tradeAction && (
        <TradeDialog
          open={!!tradeAction}
          onOpenChange={(o) => !o && setTradeAction(null)}
          ticker={fullResult.ticker}
          name={fullResult.name}
          apiPrice={livePrice || Number(fullResult.current_price ?? 0)}
          assetClass={fullResult.asset_class}
          ownedShares={ownedShares}
          defaultAction={tradeAction}
          color={color}
          onTraded={async () => {
            setTradeAction(null);
            await Promise.resolve(onTraded?.());
          }}
        />
      )}
    </>
  );
}
