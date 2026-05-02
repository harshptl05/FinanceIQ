'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

import type { Holding, PortfolioSnapshot, PortfolioSummary } from '@/lib/api';
import { fmtMoney, fmtPct } from '@/lib/format';
import { EmptyState } from '@/components/data-state';

export type Period = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

const PERIOD_DAYS: Record<Period, number | null> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  YTD: null,
  '1Y': 365,
  ALL: null,
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 text-white px-3 py-2 rounded-xl shadow-lg">
        <p className="font-semibold tabular-nums">{fmtMoney(payload[0].value)}</p>
        <p className="text-xs text-gray-300">{label}</p>
      </div>
    );
  }
  return null;
}

function filterHistory(
  history: PortfolioSnapshot[],
  period: Period,
): { label: string; value: number }[] {
  if (!history.length) return [];
  const days = PERIOD_DAYS[period];
  let cutoff: Date | null = null;
  if (period === 'YTD') cutoff = new Date(new Date().getFullYear(), 0, 1);
  else if (days) cutoff = new Date(Date.now() - days * 86400_000);

  const filtered = cutoff
    ? history.filter((h) => new Date(h.snapshot_date) >= cutoff!)
    : history;

  return filtered.map((h) => ({
    label: new Date(h.snapshot_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    value: Number(h.total_value ?? 0),
  }));
}

interface Props {
  history: PortfolioSnapshot[];
  summary: PortfolioSummary | null;
  holdings: Holding[];
  /** Optional default period — defaults to 1Y. */
  defaultPeriod?: Period;
  /** Compact = smaller paddings + 220px chart. Use on dashboard. */
  compact?: boolean;
  /** Override card chrome (background / border). Pass empty string to embed
   *  inline without our default white card style. */
  className?: string;
  title?: string;
  height?: number;
}

/** Reusable Portfolio Value chart with a period selector.
 *
 *  Originally lived inline in the Investment tab. Now also drives the
 *  Dashboard hero so users see their value trend immediately on landing
 *  instead of an empty Recent Activity panel.
 */
export function PortfolioValueChart({
  history,
  summary,
  holdings,
  defaultPeriod = '1Y',
  compact = false,
  className,
  title = 'Portfolio Value',
  height,
}: Props) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);

  const data = useMemo(
    () => filterHistory(history, period),
    [history, period],
  );

  const totalValue =
    summary?.total_value ??
    holdings.reduce((acc, h) => acc + Number(h.current_value ?? 0), 0);

  const periodChange = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0].value;
    const last = data[data.length - 1].value;
    const dollar = last - first;
    const pct = first > 0 ? (dollar / first) * 100 : 0;
    return { dollar, pct };
  }, [data]);

  const cardClass =
    className ??
    'bg-white border border-gray-100 rounded-2xl shadow-sm';
  const padding = compact ? 'p-5' : 'p-6';
  const chartHeight = height ?? (compact ? 220 : 256);

  return (
    <div className={`${cardClass} ${padding}`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className={compact ? 'font-semibold' : 'text-lg font-semibold'}>
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                period === p
                  ? 'bg-black text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <span
          className={`${compact ? 'text-3xl' : 'text-4xl'} font-bold tabular-nums`}
        >
          {fmtMoney(totalValue)}
        </span>
        {periodChange ? (
          <span
            className={`px-2.5 py-0.5 rounded-full text-sm font-medium flex items-center gap-1 ${
              periodChange.dollar >= 0
                ? 'bg-green-50 text-green-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {periodChange.dollar >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {fmtPct(periodChange.pct, { withSign: true, decimals: 2 })}
          </span>
        ) : (
          <span className="text-xs text-gray-400">
            Need ≥2 snapshots to show change
          </span>
        )}
      </div>
      <p className={`text-sm text-gray-500 ${compact ? 'mb-4' : 'mb-6'}`}>
        {periodChange
          ? `${periodChange.dollar >= 0 ? '+' : '−'}${fmtMoney(
              Math.abs(periodChange.dollar),
            )} over the selected period`
          : 'Run "Sync prices" daily to build history'}
      </p>

      <div style={{ height: chartHeight }}>
        {data.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#6366F1"
                strokeWidth={2}
                fill="url(#pvFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            title="No portfolio history yet"
            description="Once we've recorded at least two daily snapshots, your portfolio chart will appear here."
          />
        )}
      </div>
    </div>
  );
}
