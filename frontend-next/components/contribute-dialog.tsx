'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, type Goal } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  onSaved?: () => Promise<void> | void;
};

const QUICK = [50, 100, 250, 500, 1000];

export function ContributeDialog({ open, onOpenChange, goal, onSaved }: Props) {
  const [amount, setAmount] = useState('100');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setAmount('100');
  }, [open]);

  if (!goal) return null;

  const submit = async () => {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error('Enter an amount greater than 0');
      return;
    }
    setSubmitting(true);
    try {
      await api.goals.contribute(goal.id, v);
      toast.success(`Added ${fmtMoney(v)} to ${goal.goal_name}`);
      await onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not contribute');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0" showCloseButton={false}>
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 z-30 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-gray-500 border border-gray-200 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition focus:outline-hidden focus:ring-2 focus:ring-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogClose>
        <DialogHeader className="px-5 pt-5 pb-2 border-b border-gray-100">
          <DialogTitle className="text-base pr-12">
            Add to {goal.goal_name}
          </DialogTitle>
          <p className="text-xs text-gray-500">
            Logs the contribution against this goal&apos;s saved balance.
          </p>
        </DialogHeader>
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 font-medium">
              Amount
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step={25}
                className="w-full pl-6 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                autoFocus
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition"
              >
                +{fmtMoney(q, { decimals: 0 })}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Contribute
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
