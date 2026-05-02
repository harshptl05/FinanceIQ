'use client';

import { useEffect, useState } from 'react';
import { GitMerge, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { api, type FundOverlapPair } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { TickerLogo } from '@/components/ticker-logo';
import { tickerColor } from '@/lib/format';

/** Surface the most striking insight for everyday investors:
 *  "Your VTSAX and FXAIX are 88% the same stocks."
 *
 *  Computed server-side from the user's own holdings — only shows pairs
 *  with ≥10% overlap. Falls silent if the user has no overlapping funds.
 */
export function FundOverlapCard({ onSelect }: { onSelect?: (ticker: string) => void }) {
  const [pairs, setPairs] = useState<FundOverlapPair[]>([]);
  const [fundCount, setFundCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.funds
      .overlap()
      .then((res) => {
        if (cancelled) return;
        setPairs(res.pairs);
        setFundCount(res.fund_count);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-indigo-600" />
            Fund overlap
          </h2>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Analyzing your funds...
        </div>
      </div>
    );
  }

  if (error || fundCount < 2) {
    return null; // Hide entirely — nothing to compare yet.
  }

  if (pairs.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-emerald-600" />
            Fund overlap
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            All clear
          </span>
        </div>
        <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-900">
              Your funds are well-diversified.
            </p>
            <p className="text-xs text-emerald-800/80 mt-1">
              We checked all {fundCount} of your funds and didn&apos;t find any
              significant overlap (&lt;10%) — you&apos;re not paying twice for
              the same stocks.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <GitMerge className="w-4 h-4 text-amber-600" />
          Fund overlap
        </h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
          {pairs.length} pair{pairs.length === 1 ? '' : 's'}
        </span>
      </div>

      <p className="text-xs text-gray-500 mb-3 leading-snug">
        Most 401k investors hold 3-5 funds that own 70%+ the same stocks
        without realizing it. Here&apos;s where your funds duplicate each other.
      </p>

      <div className="space-y-3">
        {pairs.slice(0, 4).map((p) => {
          const pct = Math.round(p.overlap * 100);
          const severe = pct >= 70;
          const moderate = pct >= 40;
          const tone = severe ? 'rose' : moderate ? 'amber' : 'gray';
          return (
            <button
              key={`${p.a}-${p.b}`}
              onClick={() => onSelect?.(p.a)}
              className="w-full text-left rounded-xl border border-gray-100 hover:border-gray-200 transition p-3 group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center -space-x-2">
                  <TickerLogo
                    ticker={p.a}
                    color={tickerColor(p.a)}
                    size="sm"
                    rounded="full"
                  />
                  <TickerLogo
                    ticker={p.b}
                    color={tickerColor(p.b)}
                    size="sm"
                    rounded="full"
                  />
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {p.a} <span className="text-gray-400">×</span> {p.b}
                </p>
                <span
                  className={`ml-auto text-sm font-bold tabular-nums ${
                    severe
                      ? 'text-rose-600'
                      : moderate
                        ? 'text-amber-600'
                        : 'text-gray-700'
                  }`}
                >
                  {pct}% identical
                </span>
              </div>

              <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${
                    severe
                      ? 'bg-rose-500'
                      : moderate
                        ? 'bg-amber-500'
                        : 'bg-gray-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span className="truncate">
                  {p.a_name} · {fmtMoney(p.a_value)}
                </span>
                <span className="truncate text-right">
                  {p.b_name} · {fmtMoney(p.b_value)}
                </span>
              </div>

              {severe ? (
                <p className="flex items-start gap-1.5 mt-2 text-[11px] text-rose-700 leading-snug">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  These funds are nearly the same. If one falls, the other
                  almost certainly falls with it — that&apos;s not real
                  diversification.
                </p>
              ) : moderate ? (
                <p className="text-[11px] text-amber-700 mt-1.5 leading-snug">
                  Meaningful overlap. Consider whether you need both, or if a
                  single broader fund would do the job for less.
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
