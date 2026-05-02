'use client';

import { Wallet, ArrowDown } from 'lucide-react';

import { fmtMoney, fmtPct } from '@/lib/format';
import { formatExpenseRatio, formatBps } from '@/lib/funds';

type Props = {
  ticker: string;
  expenseRatio: number | null | undefined;
  currentValue: number;
  /** Optional 10y projection multiplier — defaults to 14.78 (matches the
   *  backend's 7%-growth integral). Pass 1 to disable the projection. */
  projectionMultiplier?: number;
};

/** "Hidden" expense-ratio drag, in dollars and dollars-over-10-years.
 *
 *  Most everyday investors don't realize:
 *    - 0.04% sounds tiny but compounds against returns
 *    - Active funds silently cost 0.5%-1.0%+
 *    - Over 30 years, 1% drag eats ~28% of final value
 *
 *  We surface this front and center on every fund's detail dialog.
 */
export function FundCostDrag({
  ticker,
  expenseRatio,
  currentValue,
  projectionMultiplier = 14.78,
}: Props) {
  if (expenseRatio == null || !isFinite(expenseRatio)) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
        Expense ratio unavailable for {ticker}.
      </div>
    );
  }

  const annual = currentValue * expenseRatio;
  const tenYr = annual * projectionMultiplier;

  // Severity color: low / medium / high
  const isLow = expenseRatio < 0.001; // < 10 bps
  const isHigh = expenseRatio >= 0.005; // >= 50 bps

  const tone = isHigh
    ? 'rose'
    : isLow
      ? 'emerald'
      : 'amber';
  const toneStyles = {
    emerald: {
      ring: 'border-emerald-100 bg-emerald-50/50',
      icon: 'text-emerald-600',
      label: 'text-emerald-700',
      pillBg: 'bg-emerald-100 text-emerald-800',
    },
    amber: {
      ring: 'border-amber-100 bg-amber-50/50',
      icon: 'text-amber-600',
      label: 'text-amber-700',
      pillBg: 'bg-amber-100 text-amber-800',
    },
    rose: {
      ring: 'border-rose-100 bg-rose-50/50',
      icon: 'text-rose-600',
      label: 'text-rose-700',
      pillBg: 'bg-rose-100 text-rose-800',
    },
  }[tone];

  const intuitive = isLow
    ? 'Very low cost — typical of broad index funds.'
    : isHigh
      ? 'High expense ratio — typical of actively managed funds.'
      : 'Moderate cost — middle of the pack.';

  return (
    <div className={`rounded-xl border ${toneStyles.ring} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Wallet className={`w-4 h-4 mt-0.5 ${toneStyles.icon}`} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Cost drag · expense ratio
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className={`text-2xl font-bold tabular-nums ${toneStyles.label}`}>
                {formatExpenseRatio(expenseRatio)}
              </p>
              <span className="text-xs text-gray-500 tabular-nums">
                ({formatBps(expenseRatio)})
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">{intuitive}</p>
          </div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full ${toneStyles.pillBg}`}
        >
          {isLow ? 'Low' : isHigh ? 'High' : 'Moderate'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-lg bg-white border border-gray-100 p-3">
          <p className="text-[11px] text-gray-500 flex items-center gap-1">
            <ArrowDown className="w-3 h-3 text-gray-400" />
            This year
          </p>
          <p className="text-base font-semibold tabular-nums text-gray-900 mt-0.5">
            {fmtMoney(annual)}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            on {fmtMoney(currentValue)} held
          </p>
        </div>
        <div className="rounded-lg bg-white border border-gray-100 p-3">
          <p className="text-[11px] text-gray-500 flex items-center gap-1">
            <ArrowDown className="w-3 h-3 text-gray-400" />
            10-year drag
          </p>
          <p className="text-base font-semibold tabular-nums text-gray-900 mt-0.5">
            {fmtMoney(tenYr)}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            assuming 7% annual growth
          </p>
        </div>
      </div>

      {isHigh ? (
        <p className="text-[11px] text-rose-700 mt-2.5 leading-snug">
          A comparable index fund (≈{fmtPct(0.04, { decimals: 2 })}) would cost
          you about {fmtMoney(currentValue * 0.0004)} per year — a difference of{' '}
          <span className="font-medium">
            {fmtMoney(annual - currentValue * 0.0004)}/yr
          </span>
          .
        </p>
      ) : null}
    </div>
  );
}
