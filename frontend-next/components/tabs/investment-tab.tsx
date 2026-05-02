'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import type { PortfolioData } from '@/hooks/use-portfolio-data';
import type { Holding } from '@/lib/api';
import {
  fmtMoney,
  fmtPct,
  assetLabel,
  holdingColorMap,
  relativeTime,
} from '@/lib/format';
import { RadialBarChart } from '@/components/radial-bar-chart';
import { CardSpinner, EmptyState } from '@/components/data-state';
import { StockDetailDialog } from '@/components/stock-detail-dialog';

type Period = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
type ProfitPeriod = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

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

function filterHistory(history: { snapshot_date: string; total_value: number }[], period: Period | ProfitPeriod) {
  if (!history.length) return [];
  const days = PERIOD_DAYS[period as Period];
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

export function InvestmentTab({ data }: { data: PortfolioData }) {
  const { loading, summary, history, holdings, news } = data;
  const [period, setPeriod] = useState<Period>('1Y');
  const [profitPeriod, setProfitPeriod] = useState<ProfitPeriod>('ALL');
  const [profitPeriodOpen, setProfitPeriodOpen] = useState(false);

  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const activeHolding = useMemo(
    () => holdings.find((h) => h.ticker === activeTicker) ?? null,
    [activeTicker, holdings],
  );

  // Stable per-ticker color map keyed by asset class — blue family for stocks,
  // green for bonds, amber for cash, etc. Used everywhere a holding appears so
  // VTI is always blue, BND always green, etc.
  const colorMap = useMemo(() => holdingColorMap(holdings), [holdings]);

  const filteredHistory = useMemo(
    () => filterHistory(history, period),
    [history, period],
  );

  const totalValue =
    summary?.total_value ??
    holdings.reduce((acc, h) => acc + Number(h.current_value ?? 0), 0);

  const periodChange = useMemo(() => {
    if (filteredHistory.length < 2) return null;
    const first = filteredHistory[0].value;
    const last = filteredHistory[filteredHistory.length - 1].value;
    const dollar = last - first;
    const pct = first > 0 ? (dollar / first) * 100 : 0;
    return { dollar, pct };
  }, [filteredHistory]);

  // Total profits over the selected period (current value vs value-period-ago)
  const profitFiltered = useMemo(
    () => filterHistory(history, profitPeriod),
    [history, profitPeriod],
  );

  const periodProfit = useMemo(() => {
    // For "ALL" / no history, fall back to unrealized gain vs cost basis.
    if (profitFiltered.length < 2) {
      const cost = holdings.reduce(
        (acc, h) => acc + Number(h.shares ?? 0) * Number(h.avg_cost_basis ?? 0),
        0,
      );
      const cv = holdings.reduce(
        (acc, h) => acc + Number(h.current_value ?? 0),
        0,
      );
      return {
        dollar: cv - cost,
        pct: cost > 0 ? ((cv - cost) / cost) * 100 : 0,
        baseline: cost,
        endpoint: cv,
        label: 'vs. cost basis',
      };
    }
    const first = profitFiltered[0].value;
    const last = profitFiltered[profitFiltered.length - 1].value;
    return {
      dollar: last - first,
      pct: first > 0 ? ((last - first) / first) * 100 : 0,
      baseline: first,
      endpoint: last,
      label: profitPeriod === 'ALL' ? 'all-time' : `last ${profitPeriod}`,
    };
  }, [profitFiltered, holdings, profitPeriod]);

  const totalCostBasis = holdings.reduce(
    (acc, h) => acc + Number(h.shares ?? 0) * Number(h.avg_cost_basis ?? 0),
    0,
  );
  const totalHoldingValue = holdings.reduce(
    (acc, h) => acc + Number(h.current_value ?? 0),
    0,
  );

  const distribution = useMemo(
    () =>
      holdings
        .map((h) => {
          const cv = Number(h.current_value ?? 0);
          const cost = Number(h.shares ?? 0) * Number(h.avg_cost_basis ?? 0);
          return {
            ticker: h.ticker,
            name: h.name ?? h.ticker,
            value: cv,
            percentage: totalHoldingValue > 0 ? (cv / totalHoldingValue) * 100 : 0,
            color: colorMap[h.ticker] ?? '#6366F1',
            asset_class: h.asset_class ?? 'other',
            change: cost > 0 ? ((cv - cost) / cost) * 100 : 0,
          };
        })
        .sort((a, b) => b.value - a.value),
    [holdings, totalHoldingValue, colorMap],
  );

  const topMovers = useMemo(() => {
    const movers = holdings
      .map((h) => {
        const cv = Number(h.current_value ?? 0);
        const cost = Number(h.shares ?? 0) * Number(h.avg_cost_basis ?? 0);
        const change = cost > 0 ? ((cv - cost) / cost) * 100 : 0;
        return {
          ticker: h.ticker,
          price: Number(h.current_price ?? 0),
          change,
          color: colorMap[h.ticker] ?? '#6366F1',
        };
      })
      .filter((h) => Number.isFinite(h.change))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 8);
    return movers;
  }, [holdings, colorMap]);

  const myAssets = distribution;

  // Segments to feed the radial chart for hover/click. Sorted by weight
  // descending so the biggest holding occupies the most arc.
  const radialSegments = useMemo(
    () =>
      distribution
        .filter((d) => d.percentage > 0)
        .map((d) => ({
          id: d.ticker,
          label: d.ticker,
          weight: d.percentage / 100,
          sublabel: fmtMoney(d.value),
          color: d.color,
        })),
    [distribution],
  );

  if (loading && holdings.length === 0) {
    return <CardSpinner height={400} />;
  }

  return (
    <>
      <TopMovers movers={topMovers} onSelect={setActiveTicker} />

      {/* Hero Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio value chart */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Portfolio Value</h2>
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
            <span className="text-4xl font-bold tabular-nums">
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
          <p className="text-sm text-gray-500 mb-6">
            {periodChange
              ? `${periodChange.dollar >= 0 ? '+' : '−'}${fmtMoney(
                  Math.abs(periodChange.dollar),
                )} over the selected period`
              : 'Run "Sync prices" daily to build history'}
          </p>

          <div className="h-64">
            {filteredHistory.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredHistory}>
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
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
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

        {/* Total Profits radial */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 relative">
            <h2 className="text-lg font-semibold">Total Profits</h2>
            <button
              onClick={() => setProfitPeriodOpen((o) => !o)}
              className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-full text-sm text-gray-600 transition"
            >
              {profitPeriod === 'ALL' ? 'All time' : profitPeriod}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${profitPeriodOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {profitPeriodOpen && (
              <div className="absolute top-9 right-0 z-10 bg-white border border-gray-100 rounded-xl shadow-lg p-1 w-32">
                {(['1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as ProfitPeriod[]).map(
                  (p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setProfitPeriod(p);
                        setProfitPeriodOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 ${
                        profitPeriod === p
                          ? 'font-semibold text-gray-900'
                          : 'text-gray-600'
                      }`}
                    >
                      {p === 'ALL' ? 'All time' : p}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="flex justify-center mb-6">
            <RadialBarChart
              animationKey={profitPeriod}
              centerValue={`${periodProfit.dollar >= 0 ? '+' : '−'}${fmtMoney(Math.abs(periodProfit.dollar))}`}
              centerSubvalue={fmtPct(periodProfit.pct, {
                withSign: true,
                decimals: 1,
              })}
              centerCaption={periodProfit.label}
              segments={radialSegments}
              onSegmentClick={(id) => setActiveTicker(id)}
            />
          </div>
          {radialSegments.length > 0 && (
            <>
              <p className="text-[11px] text-gray-400 text-center -mt-3 mb-3">
                Hover a slice to inspect a holding · click for details
              </p>
              {/* Compact asset-class legend so users can decode the colors at a glance */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mb-4 text-[11px] text-gray-500">
                {Array.from(
                  new Set(holdings.map((h) => h.asset_class ?? 'other')),
                ).map((ac) => {
                  const example = holdings.find(
                    (h) => (h.asset_class ?? 'other') === ac,
                  );
                  if (!example) return null;
                  return (
                    <span key={ac} className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: colorMap[example.ticker] }}
                      />
                      {assetLabel(ac)}
                    </span>
                  );
                })}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-500">
                {profitPeriod === 'ALL' ? 'Cost basis' : 'Period start'}
              </p>
              <p className="font-semibold tabular-nums mt-0.5">
                {fmtMoney(periodProfit.baseline)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-500">Market value</p>
              <p className="font-semibold tabular-nums mt-0.5">
                {fmtMoney(periodProfit.endpoint || totalHoldingValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Distribution */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Portfolio Distribution</h2>
            <span className="text-[11px] text-gray-400">click to drill in</span>
          </div>

          {distribution.length === 0 ? (
            <EmptyState
              title="No holdings yet"
              description="Add a holding to see how your money is distributed."
            />
          ) : (
            <DistributionWithHover
              distribution={distribution}
              onSelect={(t) => setActiveTicker(t)}
            />
          )}
        </div>

        {/* My Assets */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">My Assets</h2>
            <span className="text-xs text-gray-500">
              {holdings.length} holding{holdings.length === 1 ? '' : 's'}
            </span>
          </div>

          {myAssets.length === 0 ? (
            <EmptyState
              title="No holdings yet"
              description="Add holdings to see them here."
            />
          ) : (
            <div className="space-y-2">
              {myAssets.map((asset) => (
                <button
                  key={asset.ticker}
                  onClick={() => setActiveTicker(asset.ticker)}
                  className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: asset.color }}
                    >
                      {asset.ticker[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {asset.ticker}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {asset.name} · {asset.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm tabular-nums">
                      {fmtMoney(asset.value)}
                    </p>
                    <p
                      className={`text-xs font-medium flex items-center justify-end gap-0.5 ${
                        asset.change >= 0 ? 'text-green-600' : 'text-rose-500'
                      }`}
                    >
                      {asset.change >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {fmtPct(asset.change, {
                        withSign: true,
                        decimals: 2,
                      })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Market Insight (live news) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Market Insight</h2>
            <span className="text-[11px] text-gray-400 font-medium">live news</span>
          </div>

          {news.length === 0 ? (
            <EmptyState
              title="No headlines yet"
              description="Click 'Pull news' to fetch the latest headlines."
            />
          ) : (
            <div className="space-y-4">
              {news.slice(0, 5).map((item, i) => (
                <a
                  key={i}
                  href={item.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                    {(item.source ?? 'NEWS').slice(0, 4).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {item.headline}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      {item.source ?? 'Source'} ·{' '}
                      {relativeTime(item.published_at ?? item.processed_at)}
                      {item.url && <ExternalLink className="w-3 h-3" />}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <StockDetailDialog
        holding={activeHolding}
        totalPortfolioValue={totalValue}
        history={history}
        open={!!activeTicker}
        onOpenChange={(o) => !o && setActiveTicker(null)}
        color={activeTicker ? colorMap[activeTicker] : undefined}
      />
    </>
  );
}

// ---------- Portfolio Distribution (custom hover tooltip + linked highlight) ----------

type DistRow = {
  ticker: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
  asset_class: string;
  change: number;
};

function DistributionWithHover({
  distribution,
  onSelect,
}: {
  distribution: DistRow[];
  onSelect: (ticker: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const handleEnter = (ticker: string, e: React.MouseEvent) => {
    setHovered(ticker);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleLeave = () => {
    setHovered(null);
    setTipPos(null);
  };

  const hoveredRow = distribution.find((d) => d.ticker === hovered);

  return (
    <div ref={containerRef} className="relative">
      {/* Stacked bar */}
      <div
        className="h-4 rounded-full overflow-hidden flex mb-6 bg-gray-100 cursor-pointer"
        onMouseLeave={handleLeave}
      >
        {distribution.map((item) => {
          const isHovered = hovered === item.ticker;
          const isDimmed = hovered !== null && !isHovered;
          return (
            <div
              key={item.ticker}
              onMouseEnter={(e) => handleEnter(item.ticker, e)}
              onMouseMove={handleMove}
              onClick={() => onSelect(item.ticker)}
              className="h-full transition-all duration-150"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.color,
                opacity: isDimmed ? 0.35 : 1,
                transform: isHovered ? 'scaleY(1.4)' : 'scaleY(1)',
                transformOrigin: 'center',
                boxShadow: isHovered
                  ? `0 0 0 2px white, 0 0 0 3px ${item.color}`
                  : 'none',
              }}
              aria-label={`${item.ticker} ${item.percentage.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Custom tooltip */}
      {hoveredRow && tipPos && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
          style={{
            left: Math.max(70, Math.min(tipPos.x, (containerRef.current?.clientWidth ?? 300) - 70)),
            top: Math.max(8, tipPos.y - 12),
          }}
        >
          <div className="bg-gray-900 text-white rounded-xl shadow-xl px-3 py-2 min-w-[180px] border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: hoveredRow.color }}
              />
              <span className="font-semibold text-sm">
                {hoveredRow.ticker}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto uppercase tracking-wide">
                {assetLabel(hoveredRow.asset_class)}
              </span>
            </div>
            <p className="text-[11px] text-gray-300 truncate">
              {hoveredRow.name}
            </p>
            <div className="flex items-baseline justify-between mt-1.5 pt-1.5 border-t border-white/10">
              <span className="text-base font-bold tabular-nums">
                {hoveredRow.percentage.toFixed(1)}%
              </span>
              <span className="text-sm text-gray-300 tabular-nums">
                {fmtMoney(hoveredRow.value)}
              </span>
            </div>
            <p
              className={`text-[11px] mt-1 tabular-nums ${
                hoveredRow.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {hoveredRow.change >= 0 ? '+' : ''}
              {hoveredRow.change.toFixed(2)}% all-time
            </p>
            <p className="text-[10px] text-gray-500 mt-1 italic">
              Click for details →
            </p>
          </div>
          {/* tail */}
          <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1 border-r border-b border-white/10" />
        </div>
      )}

      {/* List rows — hover-linked with the bar above */}
      <div className="space-y-1">
        {distribution.map((item) => {
          const isHovered = hovered === item.ticker;
          const isDimmed = hovered !== null && !isHovered;
          return (
            <button
              key={item.ticker}
              onClick={() => onSelect(item.ticker)}
              onMouseEnter={(e) => handleEnter(item.ticker, e)}
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
              className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded-lg transition ${
                isHovered ? 'bg-gray-100' : isDimmed ? 'opacity-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {item.ticker}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.percentage.toFixed(1)}% · {assetLabel(item.asset_class)}
                  </p>
                </div>
              </div>
              <span className="font-semibold text-sm tabular-nums">
                {fmtMoney(item.value)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Top Movers (auto-scrolling, click-to-detail) ----------

function TopMovers({
  movers,
  onSelect,
}: {
  movers: Array<{
    ticker: string;
    price: number;
    change: number;
    color: string;
  }>;
  onSelect: (ticker: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // Auto-scroll: nudge the container right by 1px every ~30ms while not paused.
  useEffect(() => {
    if (paused || movers.length === 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    const id = window.setInterval(() => {
      if (!el) return;
      el.scrollLeft += 1;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) {
        el.scrollLeft = 0;
      }
    }, 30);
    return () => window.clearInterval(id);
  }, [paused, movers.length]);

  const nudge = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  if (movers.length === 0) {
    return (
      <div className="bg-gray-50 rounded-2xl p-4">
        <span className="text-xs text-gray-500 font-medium">
          Top movers will appear here once you add holdings + sync prices.
        </span>
      </div>
    );
  }

  // Duplicate the list so the auto-scroll feels infinite.
  const items = [...movers, ...movers];

  return (
    <div
      className="bg-gray-50 rounded-2xl p-4 relative group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 font-medium whitespace-nowrap pr-2 border-r border-gray-200">
          Top movers
        </span>

        <button
          onClick={() => nudge(-1)}
          className="opacity-0 group-hover:opacity-100 transition shrink-0 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>

        <div
          ref={scrollerRef}
          className="flex items-center gap-6 overflow-x-auto no-scrollbar scroll-smooth flex-1"
          style={{ scrollBehavior: 'auto' }}
        >
          {items.map((stock, i) => (
            <button
              key={`${stock.ticker}-${i}`}
              onClick={() => onSelect(stock.ticker)}
              className="flex items-center gap-3 shrink-0 hover:scale-[1.03] transition-transform cursor-pointer"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: stock.color }}
              >
                {stock.ticker[0]}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">{stock.ticker}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 tabular-nums">
                    {stock.price > 0 ? fmtMoney(stock.price) : '—'}
                  </span>
                  <span
                    className={`text-xs font-medium flex items-center gap-0.5 ${
                      stock.change >= 0 ? 'text-green-600' : 'text-rose-500'
                    }`}
                  >
                    {stock.change >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {fmtPct(stock.change, { withSign: true, decimals: 2 })}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => nudge(1)}
          className="opacity-0 group-hover:opacity-100 transition shrink-0 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
