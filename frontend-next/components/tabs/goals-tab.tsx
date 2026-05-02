'use client';

import { PiggyBank, GraduationCap, Home, Wallet, Target, Calendar } from 'lucide-react';
import type { PortfolioData } from '@/hooks/use-portfolio-data';
import type { Goal } from '@/lib/api';
import { fmtMoney, fmtPct, assetColor, assetLabel } from '@/lib/format';
import { EmptyState } from '@/components/data-state';

const GOAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  retirement: PiggyBank,
  house: Home,
  college: GraduationCap,
  emergency: Wallet,
  other: Target,
};

const GOAL_GRADIENT: Record<string, string> = {
  retirement: 'from-emerald-500 to-green-600',
  house: 'from-orange-500 to-amber-600',
  college: 'from-indigo-500 to-purple-600',
  emergency: 'from-rose-500 to-pink-600',
  other: 'from-slate-500 to-gray-700',
};

function yearsToTarget(date: string): number {
  const t = new Date(date);
  return Math.max((t.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365.25), 0);
}

function GoalProgress({ goal }: { goal: Goal }) {
  const target = Number(goal.target_amount ?? 0);
  const current = Number(goal.current_amount ?? 0);
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="font-semibold tabular-nums">{fmtMoney(current)}</span>
        <span className="text-gray-500 tabular-nums">of {fmtMoney(target)}</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all bg-gradient-to-r from-indigo-500 to-purple-600"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {pct.toFixed(0)}% of target · {yearsToTarget(goal.target_date).toFixed(1)} years to go
      </p>
    </div>
  );
}

function AllocationStrip({ allocation }: { allocation: Record<string, number> }) {
  const entries = Object.entries(allocation).filter(([, v]) => v > 0);
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  if (total === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 mb-2">Target allocation</p>
      <div className="h-2 rounded-full overflow-hidden flex bg-gray-100">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="h-full"
            style={{
              width: `${(v / total) * 100}%`,
              backgroundColor: assetColor(k),
            }}
            title={`${assetLabel(k)} • ${fmtPct(v * 100, { decimals: 0 })}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {entries.map(([k, v]) => (
          <span key={k} className="flex items-center gap-1 text-[11px] text-gray-500">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: assetColor(k) }}
            />
            {assetLabel(k)} {fmtPct(v * 100, { decimals: 0 })}
          </span>
        ))}
      </div>
    </div>
  );
}

export function GoalsTab({ data }: { data: PortfolioData }) {
  const { goals, summary } = data;

  const totalSavings = goals.reduce(
    (acc, g) => acc + Number(g.current_amount ?? 0),
    0,
  );
  const totalTarget = goals.reduce(
    (acc, g) => acc + Number(g.target_amount ?? 0),
    0,
  );
  const overallPct =
    totalTarget > 0 ? Math.min((totalSavings / totalTarget) * 100, 100) : 0;

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your goals</h1>
          <p className="text-gray-500">
            Each goal has its own glide path that adjusts as the deadline gets
            closer.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20">
          <PiggyBank className="w-10 h-10 mb-4 opacity-80" />
          <p className="text-sm opacity-80">Total saved across goals</p>
          <p className="text-3xl font-bold mt-1 tabular-nums">
            {fmtMoney(totalSavings)}
          </p>
          <div className="mt-4 bg-white/20 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="text-sm mt-2 opacity-80">
            {overallPct.toFixed(0)}% of total goal value{' '}
            {totalTarget > 0 && `(${fmtMoney(totalTarget)})`}
          </p>
        </div>

        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold mb-3">Portfolio snapshot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500">Portfolio value</p>
              <p className="text-xl font-bold tabular-nums mt-0.5">
                {fmtMoney(summary?.total_value ?? 0)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500">Expected annual return</p>
              <p className="text-xl font-bold tabular-nums mt-0.5">
                {fmtPct(summary?.expected_annual_return ?? 0, { decimals: 1 })}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500">Volatility</p>
              <p className="text-xl font-bold tabular-nums mt-0.5">
                {fmtPct(summary?.portfolio_volatility ?? 0, { decimals: 1 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <EmptyState
            title="No goals yet"
            description="Add a financial goal (retirement, house, college, emergency) and we'll generate a target allocation that automatically adjusts as you get closer."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const Icon = GOAL_ICON[goal.goal_type] ?? Target;
            const gradient = GOAL_GRADIENT[goal.goal_type] ?? GOAL_GRADIENT.other;
            return (
              <div
                key={goal.id}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{goal.goal_name}</h3>
                      <p className="text-xs text-gray-500 capitalize">
                        {goal.goal_type} · {goal.account_type ?? 'taxable'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    {new Date(goal.target_date).getFullYear()}
                  </div>
                </div>

                <GoalProgress goal={goal} />
                {goal.target_allocation && (
                  <AllocationStrip allocation={goal.target_allocation} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
