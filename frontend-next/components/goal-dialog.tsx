'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PiggyBank,
  Home,
  GraduationCap,
  Wallet,
  Heart,
  Cat,
  Car,
  Plane,
  Target,
  Loader2,
  Calendar,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, type Goal, type GoalCreate, type GoalType } from '@/lib/api';
import { fmtMoney, fmtPct, assetColor, assetLabel } from '@/lib/format';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided we edit; otherwise we create. */
  goal?: Goal | null;
  onSaved?: () => Promise<void> | void;
};

type GoalTypeMeta = {
  type: GoalType;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  defaultYears: number;
  defaultAmount: number;
};

export const GOAL_TYPES: GoalTypeMeta[] = [
  {
    type: 'retirement',
    label: 'Retirement',
    description: 'Long-term — stocks heavy now, more bonds/cash later.',
    Icon: PiggyBank,
    gradient: 'from-emerald-500 to-green-600',
    defaultYears: 25,
    defaultAmount: 1_500_000,
  },
  {
    type: 'house',
    label: 'House down payment',
    description: 'Mid-term — shift to cash as the move-in date nears.',
    Icon: Home,
    gradient: 'from-orange-500 to-amber-600',
    defaultYears: 5,
    defaultAmount: 80_000,
  },
  {
    type: 'college',
    label: 'College / kids',
    description: '529-style glide path — risk steps down each year.',
    Icon: GraduationCap,
    gradient: 'from-indigo-500 to-purple-600',
    defaultYears: 12,
    defaultAmount: 120_000,
  },
  {
    type: 'emergency',
    label: 'Emergency fund',
    description: 'All cash — your safety net should never be at risk.',
    Icon: Wallet,
    gradient: 'from-rose-500 to-pink-600',
    defaultYears: 0,
    defaultAmount: 15_000,
  },
  {
    type: 'wedding',
    label: 'Wedding',
    description: 'Mostly cash within 2 years of the date.',
    Icon: Heart,
    gradient: 'from-pink-500 to-rose-600',
    defaultYears: 2,
    defaultAmount: 30_000,
  },
  {
    type: 'pet',
    label: 'Pet care',
    description: 'Vet bills + adoption — short timeline, low risk.',
    Icon: Cat,
    gradient: 'from-amber-500 to-yellow-600',
    defaultYears: 1,
    defaultAmount: 5_000,
  },
  {
    type: 'car',
    label: 'New car',
    description: 'Short-term — capital preservation, light growth.',
    Icon: Car,
    gradient: 'from-sky-500 to-blue-600',
    defaultYears: 3,
    defaultAmount: 35_000,
  },
  {
    type: 'travel',
    label: 'Big trip',
    description: 'Save toward a vacation or sabbatical.',
    Icon: Plane,
    gradient: 'from-cyan-500 to-teal-600',
    defaultYears: 2,
    defaultAmount: 8_000,
  },
  {
    type: 'other',
    label: 'Other',
    description: 'Custom goal — generic glide path.',
    Icon: Target,
    gradient: 'from-slate-500 to-gray-700',
    defaultYears: 5,
    defaultAmount: 25_000,
  },
];

const ACCOUNT_TYPES: Array<{ value: string; label: string; hint: string }> = [
  { value: '401k', label: '401(k)', hint: 'Pretax employer plan' },
  { value: 'ira', label: 'Traditional IRA', hint: 'Tax-deferred' },
  { value: 'roth_ira', label: 'Roth IRA', hint: 'Tax-free growth' },
  { value: 'taxable', label: 'Taxable brokerage', hint: 'Flexible withdrawals' },
  { value: 'other', label: 'Other / cash', hint: 'Savings, HYSA, etc.' },
];

const STRATEGIES: Array<{ value: string; label: string; hint: string }> = [
  {
    value: 'hybrid',
    label: 'Hybrid (recommended)',
    hint: 'Check on a schedule, only trade when drift is real.',
  },
  {
    value: 'threshold',
    label: 'Drift band',
    hint: 'Only rebalance when an asset moves > threshold.',
  },
  {
    value: 'calendar',
    label: 'Calendar',
    hint: 'Rebalance on a fixed cadence (quarterly, etc.).',
  },
  {
    value: 'cashflow',
    label: 'Cash flow',
    hint: 'Use new contributions to fix drift — taxable-friendly.',
  },
];

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultTargetDate(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return dateString(d);
}

function previewAllocation(
  goalType: string,
  targetDate: string,
): Record<string, number> {
  const t = new Date(targetDate).getTime();
  if (!Number.isFinite(t)) return {};
  const years = Math.max((t - Date.now()) / (1000 * 60 * 60 * 24 * 365.25), 0);
  // Mirror financial/glide_path.py for an instant preview without an API round-trip.
  const PATHS: Record<string, Record<number, Record<string, number>>> = {
    retirement: {
      20: { us_stocks: 0.7, intl_stocks: 0.2, bonds: 0.1, cash: 0 },
      15: { us_stocks: 0.6, intl_stocks: 0.15, bonds: 0.2, cash: 0.05 },
      10: { us_stocks: 0.5, intl_stocks: 0.1, bonds: 0.3, cash: 0.1 },
      5: { us_stocks: 0.35, intl_stocks: 0.05, bonds: 0.45, cash: 0.15 },
      2: { us_stocks: 0.2, intl_stocks: 0, bonds: 0.5, cash: 0.3 },
    },
    house: {
      5: { us_stocks: 0.4, intl_stocks: 0, bonds: 0.4, cash: 0.2 },
      3: { us_stocks: 0.2, intl_stocks: 0, bonds: 0.3, cash: 0.5 },
      1: { us_stocks: 0, intl_stocks: 0, bonds: 0.2, cash: 0.8 },
    },
    college: {
      10: { us_stocks: 0.7, intl_stocks: 0.05, bonds: 0.2, cash: 0.05 },
      5: { us_stocks: 0.4, intl_stocks: 0, bonds: 0.4, cash: 0.2 },
      2: { us_stocks: 0.1, intl_stocks: 0, bonds: 0.4, cash: 0.5 },
    },
    emergency: {
      0: { us_stocks: 0, intl_stocks: 0, bonds: 0, cash: 1 },
    },
    wedding: {
      3: { us_stocks: 0.3, intl_stocks: 0, bonds: 0.4, cash: 0.3 },
      2: { us_stocks: 0.15, intl_stocks: 0, bonds: 0.3, cash: 0.55 },
      1: { us_stocks: 0, intl_stocks: 0, bonds: 0.2, cash: 0.8 },
    },
    pet: {
      3: { us_stocks: 0.2, intl_stocks: 0, bonds: 0.4, cash: 0.4 },
      1: { us_stocks: 0, intl_stocks: 0, bonds: 0.2, cash: 0.8 },
    },
    car: {
      3: { us_stocks: 0.2, intl_stocks: 0, bonds: 0.4, cash: 0.4 },
      1: { us_stocks: 0, intl_stocks: 0, bonds: 0.2, cash: 0.8 },
    },
    travel: {
      3: { us_stocks: 0.3, intl_stocks: 0.1, bonds: 0.3, cash: 0.3 },
      1: { us_stocks: 0.1, intl_stocks: 0, bonds: 0.3, cash: 0.6 },
    },
    other: {
      20: { us_stocks: 0.6, intl_stocks: 0.15, bonds: 0.2, cash: 0.05 },
      10: { us_stocks: 0.5, intl_stocks: 0.1, bonds: 0.3, cash: 0.1 },
      5: { us_stocks: 0.4, intl_stocks: 0.05, bonds: 0.4, cash: 0.15 },
      2: { us_stocks: 0.2, intl_stocks: 0, bonds: 0.5, cash: 0.3 },
    },
  };
  const path = PATHS[goalType] ?? PATHS.other;
  const buckets = Object.keys(path)
    .map(Number)
    .sort((a, b) => a - b);
  for (const y of buckets) {
    if (years <= y) return path[y];
  }
  return path[buckets[buckets.length - 1]];
}

export function GoalDialog({ open, onOpenChange, goal, onSaved }: Props) {
  const editing = !!goal;
  const [type, setType] = useState<string>(goal?.goal_type ?? 'retirement');
  const [name, setName] = useState<string>(goal?.goal_name ?? '');
  const [targetDate, setTargetDate] = useState<string>(
    goal?.target_date?.slice(0, 10) ?? defaultTargetDate(25),
  );
  const [targetAmount, setTargetAmount] = useState<string>(
    String(goal?.target_amount ?? 1_500_000),
  );
  const [currentAmount, setCurrentAmount] = useState<string>(
    String(goal?.current_amount ?? 0),
  );
  const [accountType, setAccountType] = useState<string>(
    goal?.account_type ?? '401k',
  );
  const [strategy, setStrategy] = useState<string>(
    goal?.rebalancing_strategy ?? 'hybrid',
  );
  const [submitting, setSubmitting] = useState(false);

  // Reset whenever the dialog re-opens for a different goal (or for create).
  useEffect(() => {
    if (!open) return;
    if (goal) {
      setType(goal.goal_type ?? 'retirement');
      setName(goal.goal_name ?? '');
      setTargetDate(goal.target_date?.slice(0, 10) ?? defaultTargetDate(25));
      setTargetAmount(String(goal.target_amount ?? 0));
      setCurrentAmount(String(goal.current_amount ?? 0));
      setAccountType(goal.account_type ?? 'taxable');
      setStrategy(goal.rebalancing_strategy ?? 'hybrid');
    } else {
      const t = GOAL_TYPES.find((g) => g.type === 'retirement')!;
      setType(t.type);
      setName('Retirement');
      setTargetDate(defaultTargetDate(t.defaultYears));
      setTargetAmount(String(t.defaultAmount));
      setCurrentAmount('0');
      setAccountType('401k');
      setStrategy('hybrid');
    }
  }, [open, goal]);

  // When the user picks a type from the catalog, prefill smart defaults
  // for amount + date (only when creating, never overwrite during edit).
  const onPickType = (t: GoalTypeMeta) => {
    setType(t.type);
    if (!editing) {
      setName(t.label);
      setTargetDate(defaultTargetDate(t.defaultYears));
      setTargetAmount(String(t.defaultAmount));
      setAccountType(
        t.type === 'retirement'
          ? '401k'
          : t.type === 'emergency'
            ? 'other'
            : 'taxable',
      );
    }
  };

  const allocationPreview = useMemo(
    () => previewAllocation(type, targetDate),
    [type, targetDate],
  );

  const submit = async () => {
    const amount = Number(targetAmount);
    const current = Number(currentAmount || 0);
    if (!name.trim()) {
      toast.error('Give your goal a name');
      return;
    }
    if (!targetDate) {
      toast.error('Pick a target date');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Target amount must be greater than 0');
      return;
    }
    if (!Number.isFinite(current) || current < 0) {
      toast.error('Current amount must be 0 or higher');
      return;
    }

    setSubmitting(true);
    try {
      if (editing && goal) {
        await api.goals.update(goal.id, {
          goal_type: type,
          goal_name: name.trim(),
          target_date: targetDate,
          target_amount: amount,
          current_amount: current,
          account_type: accountType,
          rebalancing_strategy: strategy,
        });
        toast.success('Goal updated');
      } else {
        const body: GoalCreate = {
          goal_type: type,
          goal_name: name.trim(),
          target_date: targetDate,
          target_amount: amount,
          current_amount: current,
          account_type: accountType,
          rebalancing_strategy: strategy,
        };
        await api.goals.create(body);
        toast.success('Goal added');
      }
      await onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save goal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0"
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

        <DialogHeader className="px-6 pt-6 pb-2 border-b border-gray-100">
          <DialogTitle className="text-xl pr-12">
            {editing ? 'Edit goal' : 'Add a new goal'}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            We&apos;ll generate a target allocation that automatically gets safer
            as the date approaches.
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-medium">
              Goal type
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GOAL_TYPES.map((g) => {
                const active = g.type === type;
                const Icon = g.Icon;
                return (
                  <button
                    key={g.type}
                    type="button"
                    onClick={() => onPickType(g)}
                    className={`text-left rounded-xl border px-3 py-3 transition ${
                      active
                        ? 'border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/40'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Goal name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Retirement, Down payment, …"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Target date
              </label>
              <div className="relative mt-1">
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />
                <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Target amount
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  min={0}
                  step={500}
                  className="w-full pl-6 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Already saved
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  min={0}
                  step={100}
                  className="w-full pl-6 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Account
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              >
                {ACCOUNT_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label} — {a.hint}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Rebalancing strategy
              </label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              >
                {STRATEGIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                {STRATEGIES.find((s) => s.value === strategy)?.hint}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Suggested allocation
              </p>
              <p className="text-[11px] text-gray-500">
                Auto-adjusts as the date nears
              </p>
            </div>
            {Object.keys(allocationPreview).length === 0 ? (
              <p className="text-sm text-gray-500">
                Pick a target date to see your allocation.
              </p>
            ) : (
              <>
                <div className="h-2 rounded-full overflow-hidden flex bg-gray-200">
                  {Object.entries(allocationPreview)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="h-full"
                        style={{
                          width: `${v * 100}%`,
                          backgroundColor: assetColor(k),
                        }}
                        title={`${assetLabel(k)} • ${fmtPct(v * 100, { decimals: 0 })}`}
                      />
                    ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {Object.entries(allocationPreview)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => (
                      <span
                        key={k}
                        className="flex items-center gap-1 text-[11px] text-gray-600"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: assetColor(k) }}
                        />
                        {assetLabel(k)} {fmtPct(v * 100, { decimals: 0 })}
                      </span>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-white">
          <p className="text-xs text-gray-400">
            {Number(targetAmount) > 0 && (
              <>Target: {fmtMoney(Number(targetAmount))}</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3 py-2 rounded-full text-sm text-gray-600 hover:text-gray-900 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {editing ? 'Save changes' : 'Create goal'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
