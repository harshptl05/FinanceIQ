'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { Loader2, Layers, AlertCircle } from 'lucide-react';

import type { FundMetadata } from '@/lib/api';
import { fmtPct } from '@/lib/format';
import { fundMetadata } from '@/lib/funds';

type Props = {
  ticker: string;
  /** Optional preloaded metadata (saves a round-trip when caller already
   *  has it). */
  metadata?: FundMetadata | null;
};

/** "What's actually inside this fund?" — top holdings + sector pie.
 *
 *  This is the most visceral mutual-fund insight for everyday investors.
 *  Most 401k participants own funds for years without knowing what stocks
 *  they actually hold.
 */
export function FundComposition({ ticker, metadata: preloaded }: Props) {
  const [meta, setMeta] = useState<FundMetadata | null>(preloaded ?? null);
  const [loading, setLoading] = useState<boolean>(!preloaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preloaded) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fundMetadata(ticker)
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, preloaded]);

  const sectorData = useMemo(() => {
    const w = meta?.sector_weights ?? {};
    return Object.entries(w)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [meta?.sector_weights]);

  const topHoldings = useMemo(() => meta?.top_holdings ?? [], [meta]);

  // Total weight of the top-N — the rest is "everything else".
  const top10Weight = useMemo(
    () =>
      topHoldings.slice(0, 10).reduce((s, h) => s + (h.weight || 0), 0),
    [topHoldings],
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 flex items-center justify-center text-sm text-gray-500">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Looking up what&apos;s inside {ticker}...
      </div>
    );
  }

  if (error || !meta || (!topHoldings.length && !sectorData.length)) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Limited fund data available</p>
          <p className="text-xs mt-1 opacity-80">
            We don&apos;t have detailed composition data for {ticker} yet — try again
            after the next sync, or check the fund&apos;s prospectus.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Layers className="w-4 h-4 text-indigo-600" />
            What&apos;s actually inside {ticker}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {meta.fund_family ? `${meta.fund_family} · ` : ''}
            {meta.category ?? 'Mutual fund'}
            {meta.is_index_fund != null
              ? meta.is_index_fund
                ? ' · Index fund'
                : ' · Actively managed'
              : ''}
          </p>
        </div>
        {meta.source === 'curated' ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            Verified
          </span>
        ) : null}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top holdings */}
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Top 10 holdings
            </p>
            <p className="text-[11px] text-gray-400">
              {fmtPct(top10Weight * 100, { decimals: 0 })} of fund
            </p>
          </div>
          <ul className="space-y-1.5">
            {topHoldings.slice(0, 10).map((h, i) => (
              <li
                key={`${h.ticker}-${i}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-5 text-[10px] tabular-nums text-gray-400">
                  {i + 1}
                </span>
                <span className="font-medium text-gray-900 w-16 shrink-0">
                  {h.ticker || '—'}
                </span>
                <span className="text-gray-600 truncate flex-1 text-xs">
                  {h.name}
                </span>
                <span className="text-xs tabular-nums font-medium text-gray-900">
                  {fmtPct(h.weight * 100, { decimals: 1 })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sector pie */}
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
            Sector breakdown
          </p>
          {sectorData.length ? (
            <div className="flex items-center gap-3">
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorData}
                      dataKey="value"
                      innerRadius={28}
                      outerRadius={44}
                      paddingAngle={1}
                      isAnimationActive={false}
                    >
                      {sectorData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            [
                              '#6366F1',
                              '#22C55E',
                              '#F97316',
                              '#EC4899',
                              '#0EA5E9',
                              '#EAB308',
                              '#8B5CF6',
                              '#14B8A6',
                              '#EF4444',
                              '#A855F7',
                              '#06B6D4',
                            ][i % 11]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name) => [
                        fmtPct(v * 100, { decimals: 1 }),
                        name,
                      ]}
                      contentStyle={{
                        background: '#111827',
                        border: 'none',
                        borderRadius: 8,
                        color: 'white',
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 min-w-0 space-y-0.5 text-xs">
                {sectorData.slice(0, 6).map((s, i) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: [
                            '#6366F1',
                            '#22C55E',
                            '#F97316',
                            '#EC4899',
                            '#0EA5E9',
                            '#EAB308',
                          ][i % 6],
                        }}
                      />
                      <span className="text-gray-700 truncate">{s.name}</span>
                    </span>
                    <span className="tabular-nums font-medium text-gray-900">
                      {fmtPct(s.value * 100, { decimals: 1 })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Sector data unavailable</p>
          )}
        </div>
      </div>
    </div>
  );
}
