'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingDown,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FundMetadata, Holding, PortfolioSnapshot, TradeAction } from '@/lib/api';
import {
  fmtMoney,
  fmtPct,
  assetLabel,
  assetColor,
  tickerColor,
} from '@/lib/format';
import { TickerLogo } from '@/components/ticker-logo';
import {
  fundMetadata,
  hasFundData,
  isMutualFund,
} from '@/lib/funds';
import { FundComposition } from '@/components/fund-composition';
import { FundCostDrag } from '@/components/fund-cost-drag';
import { TradeDialog } from '@/components/trade-dialog';

type Props = {
  holding: Holding | null;
  totalPortfolioValue: number;
  history: PortfolioSnapshot[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional override so the modal matches the color used in the dashboard. */
  color?: string;
  /** Called after a successful trade so the parent can refetch holdings. */
  onTraded?: () => void;
};

/** Reconstruct a synthetic price history for the holding by allocating the
 * portfolio_snapshots in proportion to its current weight. We don't persist
 * per-ticker history yet, so this gives a reasonable shape and exact endpoints. */
function buildSeries(
  holding: Holding,
  totalPortfolioValue: number,
  snapshots: PortfolioSnapshot[],
): Array<{ date: string; value: number }> {
  if (!snapshots.length) return [];
  const weight =
    totalPortfolioValue > 0
      ? Number(holding.current_value ?? 0) / totalPortfolioValue
      : 0;
  if (weight === 0) return [];

  const sorted = [...snapshots].sort((a, b) =>
    a.snapshot_date.localeCompare(b.snapshot_date),
  );
  return sorted.map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    value: Number(s.total_value) * weight,
  }));
}

export function StockDetailDialog({
  holding,
  totalPortfolioValue,
  history,
  open,
  onOpenChange,
  color: colorOverride,
  onTraded,
}: Props) {
  const data = useMemo(
    () => (holding ? buildSeries(holding, totalPortfolioValue, history) : []),
    [holding, totalPortfolioValue, history],
  );

  const ticker = holding?.ticker ?? '';
  const isFundLike = !!ticker && (isMutualFund(holding) || hasFundData(ticker));
  const isFund = !!ticker && isMutualFund(holding);

  const [fundMeta, setFundMeta] = useState<FundMetadata | null>(null);
  const [fundLoading, setFundLoading] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState<TradeAction>('buy');

  useEffect(() => {
    if (!ticker || !isFundLike) {
      setFundMeta(null);
      return;
    }
    let cancelled = false;
    setFundLoading(true);
    fundMetadata(ticker)
      .then((m) => {
        if (cancelled) return;
        setFundMeta(m);
      })
      .catch(() => {
        if (cancelled) return;
        setFundMeta(null);
      })
      .finally(() => !cancelled && setFundLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ticker, isFundLike]);

  if (!holding) return null;

  const cv = Number(holding.current_value ?? 0);
  const cost = Number(holding.shares ?? 0) * Number(holding.avg_cost_basis ?? 0);
  const gain = cv - cost;
  const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
  const weight = totalPortfolioValue > 0 ? (cv / totalPortfolioValue) * 100 : 0;
  const color = colorOverride ?? tickerColor(ticker);
  const aClass = holding.asset_class ?? 'other';

  // Mutual fund expense ratio comes from either the holding row (after
  // migration 002) or the resolved fund metadata.
  const expenseRatio =
    holding.expense_ratio ?? fundMeta?.expense_ratio ?? null;

  // Period change derived from the synthetic series endpoints
  const periodChange =
    data.length >= 2
      ? data[data.length - 1].value - data[0].value
      : 0;
  const periodPct =
    data.length >= 2 && data[0].value
      ? (periodChange / data[0].value) * 100
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <TickerLogo
              ticker={ticker}
              color={color}
              size="lg"
              rounded="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl">{ticker}</DialogTitle>
                {isFund ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold tracking-wide">
                    MUTUAL FUND
                  </span>
                ) : null}
                {!isFund && hasFundData(ticker) && fundMeta?.is_index_fund ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 font-semibold tracking-wide">
                    INDEX ETF
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-gray-500 truncate">
                {holding.name ?? fundMeta?.name ?? ticker} ·{' '}
                <span
                  className="font-medium"
                  style={{ color: assetColor(aClass) }}
                >
                  {assetLabel(aClass)}
                </span>
              </p>
            </div>
            {/* Quick trade controls — visible on every detail dialog so a buy
                or sell is always one tap away, no menu hunting. Sell is
                hidden when the user doesn't actually own this ticker
                (i.e. opened from search).
                The mr-8 reserves room for the dialog's absolute-positioned
                close (X) button which sits at top-4 right-4 — without it
                the X would sit on top of the Sell pill. */}
            <div className="hidden sm:flex items-center gap-1.5 shrink-0 mt-1 mr-8">
              <button
                type="button"
                onClick={() => {
                  setTradeAction('buy');
                  setTradeOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Buy
              </button>
              {Number(holding.shares ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTradeAction('sell');
                    setTradeOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 transition"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  Sell
                </button>
              )}
            </div>
          </div>
        </DialogHeader>

        {isFund ? (
          <div className="mt-3 -mb-1 rounded-xl bg-indigo-50/60 border border-indigo-100 px-3 py-2 flex items-center gap-2 text-xs text-indigo-900">
            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>
              Mutual funds price <strong>once daily</strong> at 4:00 PM ET — the
              price you see is the latest NAV
              {holding.nav_date ? (
                <> (as of {new Date(holding.nav_date).toLocaleDateString()})</>
              ) : null}
              .
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[11px] text-gray-500">
              {isFund ? 'NAV (last close)' : 'Price'}
            </p>
            <p className="text-base font-semibold tabular-nums mt-0.5">
              {fmtMoney(holding.current_price ?? 0)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[11px] text-gray-500">Shares</p>
            <p className="text-base font-semibold tabular-nums mt-0.5">
              {Number(holding.shares ?? 0).toLocaleString('en-US', {
                maximumFractionDigits: 4,
              })}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[11px] text-gray-500">Market value</p>
            <p className="text-base font-semibold tabular-nums mt-0.5">
              {fmtMoney(cv)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[11px] text-gray-500">% of portfolio</p>
            <p className="text-base font-semibold tabular-nums mt-0.5">
              {weight.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div
            className={`rounded-xl p-4 ${
              gain >= 0
                ? 'bg-emerald-50 border border-emerald-100'
                : 'bg-rose-50 border border-rose-100'
            }`}
          >
            <p className="text-[11px] uppercase tracking-wide text-gray-600">
              Unrealized Gain / Loss
            </p>
            <div
              className={`flex items-center gap-2 mt-0.5 ${gain >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              {gain >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <p className="text-lg font-bold tabular-nums">
                {gain >= 0 ? '+' : '−'}
                {fmtMoney(Math.abs(gain))}
              </p>
              <span className="text-sm tabular-nums opacity-80">
                ({fmtPct(gainPct, { withSign: true, decimals: 2 })})
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Cost basis {fmtMoney(cost)} ·{' '}
              {fmtMoney(holding.avg_cost_basis ?? 0)} per share
            </p>
          </div>

          <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
            <p className="text-[11px] uppercase tracking-wide text-gray-600">
              Period change
            </p>
            <div
              className={`flex items-center gap-2 mt-0.5 ${periodChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              {periodChange >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <p className="text-lg font-bold tabular-nums">
                {periodChange >= 0 ? '+' : '−'}
                {fmtMoney(Math.abs(periodChange))}
              </p>
              <span className="text-sm tabular-nums opacity-80">
                ({fmtPct(periodPct, { withSign: true, decimals: 2 })})
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Estimated from your portfolio history (last{' '}
              {Math.max(data.length, 1)} days)
            </p>
          </div>
        </div>

        {isFundLike ? (
          <div className="mt-4 space-y-4">
            <FundComposition ticker={ticker} metadata={fundMeta} />
            {expenseRatio != null ? (
              <FundCostDrag
                ticker={ticker}
                expenseRatio={expenseRatio}
                currentValue={cv}
              />
            ) : fundLoading ? null : null}
          </div>
        ) : null}

        {/* Mobile-only Buy/Sell row — header buttons hide < sm */}
        <div className="sm:hidden flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => {
              setTradeAction('buy');
              setTradeOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Buy
          </button>
          {Number(holding.shares ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                setTradeAction('sell');
                setTradeOpen(true);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 transition"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              Sell
            </button>
          )}
        </div>

        <div className="h-48 mt-4">
          {data.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="sd-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: '#111827',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [fmtMoney(v), 'Value']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill="url(#sd-fill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              Not enough portfolio history yet — sync prices daily to populate
              this chart.
            </div>
          )}
        </div>
      </DialogContent>

      <TradeDialog
        open={tradeOpen}
        onOpenChange={setTradeOpen}
        ticker={ticker}
        name={holding.name ?? ticker}
        apiPrice={Number(holding.current_price ?? 0)}
        assetClass={aClass}
        ownedShares={Number(holding.shares ?? 0)}
        defaultAction={tradeAction}
        color={color}
        onTraded={() => {
          // Bubble up so the parent (InvestmentTab / search flow) can refresh
          // holdings, summary, allocation. Closing the detail dialog too keeps
          // the user oriented on whichever view they came from.
          onTraded?.();
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
