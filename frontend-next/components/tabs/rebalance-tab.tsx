'use client';

import { useMemo, useState } from 'react';
import {
  Scale,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle2,
  X,
} from 'lucide-react';
import type { PortfolioData } from '@/hooks/use-portfolio-data';
import type { Recommendation } from '@/lib/api';
import { fmtMoney, fmtPct, assetColor, assetLabel } from '@/lib/format';
import { EmptyState } from '@/components/data-state';
import { api } from '@/lib/api';
import { toast } from 'sonner';

function urgencyClass(u?: string | null) {
  if (u === 'act_now') return 'from-rose-500 to-pink-600';
  if (u === 'act_soon') return 'from-amber-500 to-orange-600';
  return 'from-indigo-500 to-purple-600';
}

function urgencyBadge(u?: string | null) {
  if (u === 'act_now') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (u === 'act_soon') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function RecommendationCard({
  rec,
  onAct,
  onDismiss,
  busy,
}: {
  rec: Recommendation;
  onAct: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-6 text-white relative overflow-hidden bg-gradient-to-br ${urgencyClass(rec.urgency)}`}
    >
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/5 rounded-full blur-2xl" />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium opacity-80 capitalize">
              {rec.trigger_type?.replace('_', ' ') ?? 'Rebalance'}
            </span>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white capitalize`}
          >
            {(rec.urgency ?? 'monitor').replace('_', ' ')}
          </span>
        </div>

        <p className="text-lg font-bold leading-snug mb-2">
          {rec.plain_english_explanation ??
            rec.trigger_description ??
            'Rebalancing recommendation'}
        </p>

        {rec.recommended_trades && rec.recommended_trades.length > 0 && (
          <div className="bg-black/20 rounded-xl p-3 mb-3">
            <p className="text-[11px] uppercase tracking-wide opacity-80 mb-2">
              Recommended trades
            </p>
            <div className="space-y-1.5">
              {rec.recommended_trades.slice(0, 4).map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        t.action === 'buy'
                          ? 'bg-emerald-500/30 text-emerald-100'
                          : 'bg-rose-500/30 text-rose-100'
                      }`}
                    >
                      {t.action}
                    </span>
                    <span>
                      {t.ticker ?? (t.asset_class ? assetLabel(t.asset_class) : '—')}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmtMoney(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {rec.tax_loss_harvesting_opportunity && rec.tax_notes && (
          <div className="text-[12px] opacity-90 mb-3 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {rec.tax_notes}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <button
            disabled={busy}
            onClick={onAct}
            className="px-4 py-2 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-gray-100 transition disabled:opacity-50 flex items-center gap-1"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Acknowledge
          </button>
          <button
            disabled={busy}
            onClick={onDismiss}
            className="px-4 py-2 bg-white/10 text-white rounded-full text-sm font-medium hover:bg-white/20 transition disabled:opacity-50 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function RebalanceTab({ data }: { data: PortfolioData }) {
  const { summary, recommendations, calibration, refresh } = data;
  const [busy, setBusy] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const drift = summary?.drift ?? {};
  const targetAlloc = summary?.target_allocation ?? {};
  const currentAlloc = summary?.current_allocation ?? {};

  const driftRows = useMemo(() => {
    const keys = Array.from(
      new Set([...Object.keys(targetAlloc), ...Object.keys(currentAlloc)]),
    );
    return keys
      .map((k) => ({
        key: k,
        current: currentAlloc[k] ?? 0,
        target: targetAlloc[k] ?? 0,
        drift: drift[k] ?? 0,
      }))
      .filter((r) => r.current > 0 || r.target > 0)
      .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
  }, [currentAlloc, targetAlloc, drift]);

  const updateStatus = async (id: string, status: string) => {
    setBusy(id);
    try {
      await api.rebalancing.updateStatus(id, status);
      await refresh();
      toast.success('Updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  };

  const triggerNow = async () => {
    setTriggering(true);
    try {
      await api.rebalancing.trigger();
      await refresh();
      toast.success('Re-evaluated rebalancing');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rebalance</h1>
          <p className="text-gray-500">
            Drift, recommended trades, and tax-aware notes — generated from your
            real holdings.
          </p>
        </div>
        <button
          onClick={triggerNow}
          disabled={triggering}
          className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition flex items-center gap-2 disabled:opacity-60"
        >
          {triggering ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Re-check now
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Allocation drift</h2>
            <span className="text-xs text-gray-500">
              Target vs current per asset class
            </span>
          </div>

          {driftRows.length === 0 ? (
            <EmptyState
              title="No allocation data"
              description="Add a goal with a target allocation, then sync prices to see drift."
            />
          ) : (
            <div className="space-y-5">
              {driftRows.map((row) => {
                const driftPct = row.drift * 100;
                const big = Math.abs(driftPct) > 5;
                return (
                  <div key={row.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: assetColor(row.key) }}
                        />
                        <p className="text-sm font-semibold">
                          {assetLabel(row.key)}
                        </p>
                        {big && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                            outside band
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs font-medium tabular-nums ${
                          driftPct > 0
                            ? 'text-rose-600'
                            : driftPct < 0
                              ? 'text-blue-600'
                              : 'text-gray-400'
                        }`}
                      >
                        {fmtPct(driftPct, { withSign: true, decimals: 1 })}
                      </p>
                    </div>
                    <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="absolute h-full rounded-full"
                        style={{
                          width: `${row.target * 100}%`,
                          backgroundColor: assetColor(row.key),
                          opacity: 0.25,
                        }}
                      />
                      <div
                        className="absolute h-full rounded-full"
                        style={{
                          width: `${row.current * 100}%`,
                          backgroundColor: assetColor(row.key),
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-500">
                      <span>
                        Current {fmtPct(row.current * 100, { decimals: 1 })}
                      </span>
                      <span>
                        Target {fmtPct(row.target * 100, { decimals: 1 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold mb-2">Recommendation accuracy</h2>
          <p className="text-xs text-gray-500 mb-4">
            How often our past recommendations actually improved portfolio
            performance after 30 days.
          </p>
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
            <p className="text-sm opacity-80">Hit rate</p>
            <p className="text-4xl font-bold mt-1 tabular-nums">
              {calibration?.accuracy_pct != null
                ? `${calibration.accuracy_pct.toFixed(0)}%`
                : '—'}
            </p>
            <p className="text-xs opacity-80 mt-2">
              {calibration?.total_evaluated ?? 0} recommendation
              {(calibration?.total_evaluated ?? 0) === 1 ? '' : 's'} evaluated
              · {calibration?.correct ?? 0} correct
            </p>
          </div>

          <details className="mt-5 p-4 bg-gray-50 rounded-xl text-xs text-gray-600 leading-relaxed group">
            <summary className="cursor-pointer list-none">
              <span className="font-semibold text-gray-900 inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Shannon&apos;s Demon
                <span className="ml-1 text-[10px] uppercase tracking-wide text-indigo-500 font-medium opacity-70 group-hover:opacity-100">
                  what is this?
                </span>
              </span>
              <p className="mt-1">
                Regular rebalancing typically adds an estimated{' '}
                <span className="font-semibold">0.5–1.5%</span> annual return on
                top of buy-and-hold — not just risk control, but a return
                strategy.
              </p>
            </summary>
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
              <p>
                Named after Claude Shannon (the information-theory legend), who
                showed in a 1986 lecture that{' '}
                <span className="font-medium text-gray-900">
                  rebalancing two volatile assets back to a fixed mix turns
                  volatility into return
                </span>{' '}
                — even when neither asset earns anything on average.
              </p>
              <p>
                The mechanism: rebalancing forces you to{' '}
                <span className="font-medium text-gray-900">
                  systematically sell what went up
                </span>{' '}
                and{' '}
                <span className="font-medium text-gray-900">
                  buy what went down
                </span>
                . Over many cycles, this harvests the spread between the
                arithmetic and geometric means of your returns.
              </p>
              <p className="italic text-gray-500">
                Why &quot;demon&quot;? It looks like free energy — like Maxwell&apos;s demon
                — but it&apos;s really being paid for by the volatility itself.
              </p>
            </div>
          </details>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-lg mb-3">
          Open recommendations ({recommendations.length})
        </h2>
        {recommendations.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <EmptyState
              title="Portfolio is balanced"
              description="No open rebalancing actions. The agent re-checks each time prices update or a goal timeline shifts."
              action={
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  Use &quot;Re-check now&quot; to manually trigger an evaluation
                </span>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                busy={busy === rec.id}
                onAct={() => updateStatus(rec.id, 'acted')}
                onDismiss={() => updateStatus(rec.id, 'dismissed')}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
