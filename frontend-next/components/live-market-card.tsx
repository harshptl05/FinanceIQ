'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Pause, Play, TrendingDown, TrendingUp } from 'lucide-react';
import { MarketChart, type MarketChartKind } from '@/components/market-chart';
import { TickerLogo } from '@/components/ticker-logo';
import {
  fmtMoney,
  fmtPct,
  holdingColorMap,
  relativeTime,
} from '@/lib/format';
import { useLivePrices } from '@/lib/live-prices';
import type { Holding } from '@/lib/api';

interface Props {
  holdings: Holding[];
  /** Optional: set the ticker that should be selected on first render. */
  initialTicker?: string;
}

/**
 * Live Market hero card for the Investment tab.
 *
 *  • Top: row of selectable holdings (logo + ticker + live price + change)
 *  • Body: a 320-tall lightweight-charts pane that ticks every 2 seconds
 *  • Bottom: tiny "LIVE · last tick Xs ago" indicator + pause toggle
 *
 * Picking a ticker switches the chart but DOESN'T stop the other tickers'
 * live state — every holding keeps its last-known live price in the global
 * store, so portfolio value / P&L on the rest of the page stays in sync.
 */
export function LiveMarketCard({ holdings, initialTicker }: Props) {
  const eligible = useMemo(
    () =>
      holdings
        .filter((h) => Number(h.current_price ?? 0) > 0)
        .sort(
          (a, b) =>
            Number(b.current_value ?? 0) - Number(a.current_value ?? 0),
        ),
    [holdings],
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

  const activeHolding = eligible.find((h) => h.ticker === active);

  if (eligible.length === 0 || !activeHolding) {
    return null;
  }

  const livePrice = prices[active] ?? Number(activeHolding.current_price ?? 0);
  const basePrice = Number(activeHolding.current_price ?? 0);
  const dollarChange = livePrice - basePrice;
  const pctChange = basePrice > 0 ? (dollarChange / basePrice) * 100 : 0;
  const positive = dollarChange >= 0;

  const accent = colorMap[active] ?? '#6366F1';
  const kind: MarketChartKind =
    activeHolding.asset_class === 'cash' ? 'line' : 'candlestick';

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
                Live Market
              </h2>
              <p className="text-[11px] text-gray-500">
                Simulated tick every 2s · powers your live P&amp;L
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
          </div>
        </div>

        {/* Ticker pill row — auto-scrolls horizontally if too many */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {eligible.slice(0, 8).map((h) => {
            const live = prices[h.ticker] ?? Number(h.current_price ?? 0);
            const base = Number(h.current_price ?? 0);
            const ch = base > 0 ? ((live - base) / base) * 100 : 0;
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
                className={`text-xs font-semibold flex items-center gap-1 ${
                  positive ? 'text-emerald-600' : 'text-rose-500'
                }`}
              >
                {positive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {positive ? '+' : '−'}
                {fmtMoney(Math.abs(dollarChange))} (
                {fmtPct(Math.abs(pctChange), { decimals: 2 })}) since open
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

        {/* The chart itself — keyed by ticker so a new MarketChart instance
            mounts cleanly when the user switches selection. */}
        <MarketChart
          key={active}
          ticker={active}
          basePrice={basePrice}
          assetClass={activeHolding.asset_class}
          color={accent}
          kind={kind}
          height={300}
          intervalMs={2000}
        />

        <p className="text-[10px] text-gray-400 mt-3 text-center">
          Movement is simulated from a random walk seeded by the ticker so the
          demo runs 24/7. Your live P&amp;L on this page updates from these
          ticks too.
        </p>
      </div>
    </div>
  );
}
