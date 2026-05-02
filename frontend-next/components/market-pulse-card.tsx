'use client';

import { useMemo } from 'react';
import {
  Activity,
  ArrowUpRight,
  ExternalLink,
  Loader2,
  Minus,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMarketPulse } from '@/hooks/use-market-pulse';
import { fmtMoney, holdingColorMap, relativeTime } from '@/lib/format';
import { TickerLogo } from '@/components/ticker-logo';
import type { PulseItem } from '@/lib/api';
import type { Holding } from '@/lib/api';

function impactStyle(i: PulseItem['impact']) {
  if (i === 'positive') {
    return {
      label: 'Bullish',
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: TrendingUp,
      iconClass: 'text-emerald-600',
      bar: 'bg-emerald-500',
    };
  }
  if (i === 'negative') {
    return {
      label: 'Bearish',
      pill: 'bg-rose-50 text-rose-700 border-rose-200',
      Icon: TrendingDown,
      iconClass: 'text-rose-500',
      bar: 'bg-rose-500',
    };
  }
  return {
    label: 'Neutral',
    pill: 'bg-blue-50 text-blue-700 border-blue-200',
    Icon: Minus,
    iconClass: 'text-blue-600',
    bar: 'bg-blue-400',
  };
}

interface Props {
  /** User's holdings — used so we can color the ticker chip the same as
   *  every other surface in the app, and resolve a logo when the alert
   *  references an asset class instead of a single ticker. */
  holdings: Holding[];
  /** Compact mode trims paddings so the card matches the height of
   *  Quick Actions (~360-400px). Default true on dashboard. */
  compact?: boolean;
  className?: string;
}

export function MarketPulseCard({
  holdings,
  compact = true,
  className = '',
}: Props) {
  const { items, loading, flash, triggering, triggerRefresh } =
    useMarketPulse(4);

  const colorMap = useMemo(() => holdingColorMap(holdings), [holdings]);

  const visible = items.slice(0, 4);

  const handleRefresh = async () => {
    if (triggering) return;
    const t = toast.loading('Pulling news + asking the classifier...');
    const res = await triggerRefresh();
    if (!res.pipelineOk) {
      toast.error(res.error || 'News pipeline failed', { id: t });
      return;
    }
    if (res.newItems) {
      toast.success("Found news that moves your portfolio", { id: t });
    } else {
      toast.message(
        'Latest news pulled — none of it materially affects your holdings.',
        { id: t },
      );
    }
  };

  return (
    <div
      className={`bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Activity className="w-4 h-4 text-white" />
            </div>
            {/* live dot — pulses when the realtime channel is open */}
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                flash
                  ? 'bg-emerald-500 animate-ping-slow'
                  : 'bg-emerald-400'
              }`}
            />
          </div>
          <div>
            <h2 className="font-semibold text-sm leading-tight">
              AI Market Pulse
            </h2>
            <p className="text-[11px] text-gray-500">
              Live news that moves <em>your</em> portfolio
            </p>
          </div>
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={triggering}
          aria-busy={triggering}
          className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60 disabled:hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition"
        >
          {triggering ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <RefreshCcw className="w-3 h-3" />
              Refresh
            </>
          )}
        </button>
      </div>

      <div className={`flex-1 px-5 ${compact ? 'pb-4' : 'pb-5'}`}>
        {loading && items.length === 0 ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center text-gray-500 py-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-3">
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xs font-medium text-gray-700">
              No pulse yet
            </p>
            <p className="text-[11px] text-gray-500 mt-1 max-w-[240px]">
              When the classifier finds news that moves your holdings, it&apos;ll show up here in real time.
            </p>
            <button
              onClick={() => void handleRefresh()}
              disabled={triggering}
              className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-white bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-3 py-1.5 rounded-full shadow-sm shadow-indigo-500/20 transition disabled:opacity-60"
            >
              {triggering ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Scanning headlines...
                </>
              ) : (
                <>
                  <RefreshCcw className="w-3 h-3" />
                  Scan latest news
                </>
              )}
            </button>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {visible.map((item) => {
              const style = impactStyle(item.impact);
              const Icon = style.Icon;
              const primaryTicker =
                item.affected_holdings.find((t) => colorMap[t]) ??
                item.affected_holdings[0] ??
                '';
              const color = colorMap[primaryTicker] ?? '#6366F1';

              const Row = (
                <li
                  className={`relative flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/60 transition group ${
                    !item.read ? 'bg-gray-50/40' : ''
                  }`}
                >
                  {/* impact stripe */}
                  <span
                    className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${style.bar}`}
                  />

                  {primaryTicker ? (
                    <TickerLogo
                      ticker={primaryTicker}
                      color={color}
                      size="sm"
                      rounded="lg"
                    />
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        item.impact === 'positive'
                          ? 'bg-emerald-50'
                          : item.impact === 'negative'
                            ? 'bg-rose-50'
                            : 'bg-blue-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${style.iconClass}`} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${style.pill}`}
                      >
                        {style.label}
                      </span>
                      {item.affected_holdings.length > 0 && (
                        <span className="text-[11px] font-semibold tabular-nums text-gray-700">
                          {item.affected_holdings.slice(0, 3).join(' · ')}
                          {item.affected_holdings.length > 3
                            ? ` +${item.affected_holdings.length - 3}`
                            : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-gray-900 mt-1 line-clamp-2 leading-snug">
                      {item.headline ?? item.explanation ?? 'Portfolio update'}
                    </p>
                    {item.explanation && item.headline && (
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                        {item.explanation}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                      {item.source && <span>{item.source}</span>}
                      {item.source && <span>•</span>}
                      <span>{relativeTime(item.created_at)}</span>
                      {typeof item.dollar_impact === 'number' &&
                        item.dollar_impact !== 0 && (
                          <>
                            <span>•</span>
                            <span
                              className={`font-semibold tabular-nums ${
                                item.dollar_impact >= 0
                                  ? 'text-emerald-600'
                                  : 'text-rose-500'
                              }`}
                            >
                              {item.dollar_impact >= 0 ? '+' : '−'}
                              {fmtMoney(Math.abs(item.dollar_impact))}
                            </span>
                          </>
                        )}
                    </div>
                  </div>

                  {item.url ? (
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" />
                  )}
                </li>
              );

              return item.url ? (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {Row}
                </a>
              ) : (
                <div key={item.id}>{Row}</div>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
