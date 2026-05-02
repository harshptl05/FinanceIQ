'use client';

import { useMemo, useState } from 'react';
import {
  PiggyBank,
  GraduationCap,
  Home,
  Wallet,
  Heart,
  Cat,
  Car,
  Plane,
  Target,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Check,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { PortfolioData } from '@/hooks/use-portfolio-data';
import { api, type Goal } from '@/lib/api';
import { fmtMoney, fmtPct, assetColor, assetLabel } from '@/lib/format';
import { EmptyState } from '@/components/data-state';
import { GoalDialog, GOAL_TYPES } from '@/components/goal-dialog';
import { ContributeDialog } from '@/components/contribute-dialog';
import { toast } from 'sonner';

const GOAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  retirement: PiggyBank,
  house: Home,
  college: GraduationCap,
  emergency: Wallet,
  wedding: Heart,
  pet: Cat,
  car: Car,
  travel: Plane,
  other: Target,
};

const GOAL_GRADIENT: Record<string, string> = {
  retirement: 'from-emerald-500 to-green-600',
  house: 'from-orange-500 to-amber-600',
  college: 'from-indigo-500 to-purple-600',
  emergency: 'from-rose-500 to-pink-600',
  wedding: 'from-pink-500 to-rose-600',
  pet: 'from-amber-500 to-yellow-600',
  car: 'from-sky-500 to-blue-600',
  travel: 'from-cyan-500 to-teal-600',
  other: 'from-slate-500 to-gray-700',
};

function yearsToTarget(date: string): number {
  const t = new Date(date);
  return Math.max(
    (t.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365.25),
    0,
  );
}

/** Required monthly PMT to hit FV from PV at annual rate r over n months. */
function suggestedMonthly(
  current: number,
  target: number,
  years: number,
  annualReturn: number,
): number {
  if (target <= current) return 0;
  const n = Math.max(years * 12, 1);
  const r = annualReturn / 12;
  const fv = target;
  const pv = current;
  if (r <= 0.0001) {
    return Math.max((fv - pv) / n, 0);
  }
  const grow = Math.pow(1 + r, n);
  const pmt = (fv - pv * grow) / ((grow - 1) / r);
  return Math.max(pmt, 0);
}

/** Project the FV of (current + monthly PMT) at annual return r for n years. */
function projectedValue(
  current: number,
  monthly: number,
  years: number,
  annualReturn: number,
): number {
  const n = Math.max(years * 12, 0);
  const r = annualReturn / 12;
  if (n === 0) return current;
  if (r <= 0.0001) return current + monthly * n;
  const grow = Math.pow(1 + r, n);
  return current * grow + monthly * ((grow - 1) / r);
}

function GoalProgress({ goal }: { goal: Goal }) {
  const target = Number(goal.target_amount ?? 0);
  const current = Number(goal.current_amount ?? 0);
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const years = yearsToTarget(goal.target_date);
  const remaining = Math.max(target - current, 0);

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
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>
          {pct.toFixed(0)}% saved
          {remaining > 0 && (
            <> · {fmtMoney(remaining, { decimals: 0 })} to go</>
          )}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {years < 1
            ? `${Math.max(Math.round(years * 12), 0)} months`
            : `${years.toFixed(1)} years`}
        </span>
      </div>
    </div>
  );
}

function AllocationStrip({
  allocation,
}: {
  allocation: Record<string, number>;
}) {
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
          <span
            key={k}
            className="flex items-center gap-1 text-[11px] text-gray-500"
          >
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

function StatusPill({
  state,
}: {
  state: 'on_track' | 'behind' | 'ahead' | 'no_target';
}) {
  if (state === 'no_target') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
        Set a target
      </span>
    );
  }
  if (state === 'on_track') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
        On track
      </span>
    );
  }
  if (state === 'ahead') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
        Ahead of plan
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
      Needs more
    </span>
  );
}

function GoalCard({
  goal,
  expectedReturn,
  onEdit,
  onContribute,
  onDelete,
  busyDelete,
}: {
  goal: Goal;
  expectedReturn: number;
  onEdit: (g: Goal) => void;
  onContribute: (g: Goal) => void;
  onDelete: (g: Goal) => Promise<void>;
  busyDelete: boolean;
}) {
  const Icon = GOAL_ICON[goal.goal_type] ?? Target;
  const gradient = GOAL_GRADIENT[goal.goal_type] ?? GOAL_GRADIENT.other;
  const target = Number(goal.target_amount ?? 0);
  const current = Number(goal.current_amount ?? 0);
  const years = yearsToTarget(goal.target_date);

  const monthly = suggestedMonthly(current, target, years, expectedReturn);
  const projected = projectedValue(current, 0, years, expectedReturn);
  const ratio = target > 0 ? projected / target : 0;
  const state: 'on_track' | 'behind' | 'ahead' | 'no_target' =
    target <= 0
      ? 'no_target'
      : ratio >= 1.05
        ? 'ahead'
        : ratio >= 0.95
          ? 'on_track'
          : 'behind';

  const [confirming, setConfirming] = useState(false);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition group">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shrink-0`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{goal.goal_name}</h3>
              <StatusPill state={state} />
            </div>
            <p className="text-xs text-gray-500 capitalize">
              {goal.goal_type.replace('_', ' ')} ·{' '}
              {(goal.account_type ?? 'taxable').replace('_', ' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
          <Calendar className="w-3 h-3" />
          {new Date(goal.target_date).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          })}
        </div>
      </div>

      <GoalProgress goal={goal} />

      {target > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
              Suggested / month
            </p>
            <p className="text-sm font-semibold tabular-nums mt-0.5 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              {fmtMoney(monthly, { decimals: 0 })}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
              Projected at goal
            </p>
            <p className="text-sm font-semibold tabular-nums mt-0.5 inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              {fmtMoney(projected, { decimals: 0 })}
            </p>
          </div>
        </div>
      )}

      {goal.target_allocation && (
        <AllocationStrip allocation={goal.target_allocation} />
      )}

      <div className="mt-5 flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onContribute(goal)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Contribute
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(goal)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          {confirming ? (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-2 py-1.5 rounded-full text-xs text-gray-500 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyDelete}
                onClick={async () => {
                  await onDelete(goal);
                  setConfirming(false);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Confirm
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function GoalsTab({ data }: { data: PortfolioData }) {
  const { goals, summary, refresh } = data;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalSavings = useMemo(
    () => goals.reduce((acc, g) => acc + Number(g.current_amount ?? 0), 0),
    [goals],
  );
  const totalTarget = useMemo(
    () => goals.reduce((acc, g) => acc + Number(g.target_amount ?? 0), 0),
    [goals],
  );
  const overallPct =
    totalTarget > 0 ? Math.min((totalSavings / totalTarget) * 100, 100) : 0;

  const expectedReturn = (summary?.expected_annual_return ?? 7) / 100;

  const monthlyAcrossAll = useMemo(
    () =>
      goals.reduce((acc, g) => {
        const target = Number(g.target_amount ?? 0);
        const current = Number(g.current_amount ?? 0);
        const years = yearsToTarget(g.target_date);
        return acc + suggestedMonthly(current, target, years, expectedReturn);
      }, 0),
    [goals, expectedReturn],
  );

  const onDelete = async (g: Goal) => {
    setDeletingId(g.id);
    try {
      await api.goals.remove(g.id);
      toast.success(`Deleted ${g.goal_name}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    } finally {
      setDeletingId(null);
    }
  };

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
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition"
        >
          <Plus className="w-4 h-4" />
          New goal
        </button>
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
          {monthlyAcrossAll > 0 && (
            <p className="text-xs mt-3 opacity-90 inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Suggested combined monthly contribution:{' '}
              <span className="font-semibold ml-1">
                {fmtMoney(monthlyAcrossAll, { decimals: 0 })}
              </span>
            </p>
          )}
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
            description="Add your first goal — retirement, a house, college, an emergency fund, even a wedding or a new pet — and we'll generate a target allocation that gets safer as you get closer."
            action={
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition"
              >
                <Plus className="w-4 h-4" />
                Add a goal
              </button>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6">
            {GOAL_TYPES.slice(0, 6).map((g) => {
              const Icon = g.Icon;
              return (
                <button
                  key={g.type}
                  type="button"
                  onClick={() => setAdding(true)}
                  className="text-left rounded-xl border border-gray-200 hover:border-gray-300 px-3 py-3 transition bg-white"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-white bg-gradient-to-br ${g.gradient}`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-semibold text-sm">{g.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    {g.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              expectedReturn={expectedReturn}
              onEdit={(g) => setEditing(g)}
              onContribute={(g) => setContributing(g)}
              onDelete={onDelete}
              busyDelete={deletingId === goal.id}
            />
          ))}
        </div>
      )}

      <GoalDialog
        open={adding}
        onOpenChange={setAdding}
        onSaved={async () => {
          await refresh();
        }}
      />
      <GoalDialog
        open={!!editing}
        goal={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={async () => {
          await refresh();
        }}
      />
      <ContributeDialog
        open={!!contributing}
        goal={contributing}
        onOpenChange={(o) => !o && setContributing(null)}
        onSaved={async () => {
          await refresh();
        }}
      />
    </>
  );
}
