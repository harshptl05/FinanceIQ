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
  Clock,
  Check,
} from 'lucide-react';
import type { PortfolioData } from '@/hooks/use-portfolio-data';
import type { Recommendation, TradeInstruction } from '@/lib/api';
import { fmtMoney, fmtPct, assetColor, assetLabel } from '@/lib/format';
import { EmptyState } from '@/components/data-state';
import { api } from '@/lib/api';
import { toast } from 'sonner';

function urgencyClass(u?: string | null) {
  if (u === 'act_now') return 'from-rose-500 to-pink-600';
  if (u === 'act_soon') return 'from-amber-500 to-orange-600';
  return 'from-indigo-500 to-purple-600';
}

type CardPhase =
  | 'recommendation'
  | 'choose_action'
  | 'guided_trades'
  | 'remind_confirmed'
  | 'dismissed_confirmed'
  | 'complete';

function tradeTitle(trade: TradeInstruction) {
  const verb = trade.action === 'sell' ? 'Sell' : 'Buy';
  return `${verb} ${trade.name || trade.ticker}`;
}

function RecommendationCard({
  rec,
  refresh,
}: {
  rec: Recommendation;
  refresh: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<CardPhase>('recommendation');
  const [busy, setBusy] = useState(false);
  const [loadingInstructions, setLoadingInstructions] = useState(false);
  const [applying, setApplying] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [tradeInstructions, setTradeInstructions] = useState<TradeInstruction[]>(
    [],
  );
  const [currentTradeIndex, setCurrentTradeIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<
    Record<number, number[]>
  >({});
  const [strategyNote, setStrategyNote] = useState<string | null>(null);

  const contentMuted =
    phase !== 'recommendation' && phase !== 'complete';

  const toggleStep = (tradeIdx: number, stepIdx: number) => {
    setCompletedSteps((prev) => {
      const cur = prev[tradeIdx] ?? [];
      const has = cur.includes(stepIdx);
      const next = has
        ? cur.filter((i) => i !== stepIdx)
        : [...cur, stepIdx].sort((a, b) => a - b);
      return { ...prev, [tradeIdx]: next };
    });
  };

  const stepsCompleteFor = (tradeIdx: number) => {
    const steps = tradeInstructions[tradeIdx]?.steps ?? [];
    const done = new Set(completedSteps[tradeIdx] ?? []);
    return steps.length > 0 && steps.every((_, i) => done.has(i));
  };

  const onChooseRebalanceForMe = async () => {
    setLoadingInstructions(true);
    try {
      const { instructions } =
        await api.rebalancing.generateInstructions(rec.id);
      if (!instructions?.length) {
        toast.error('No instructions returned — try again.');
        return;
      }
      setTradeInstructions(instructions);
      setCurrentTradeIndex(0);
      setCompletedSteps({});
      setPhase('guided_trades');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load guide');
    } finally {
      setLoadingInstructions(false);
    }
  };

  const onRemindLater = async () => {
    setBusy(true);
    try {
      const remindAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString();
      await api.rebalancing.updateStatus(rec.id, {
        status: 'pending',
        remind_at: remindAt,
      });
      await refresh();
      setPhase('remind_confirmed');
      toast.success('Reminder set for tomorrow');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const onIllHandleIt = async () => {
    setBusy(true);
    try {
      await api.rebalancing.updateStatus(rec.id, { status: 'dismissed' });
      setPhase('dismissed_confirmed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const onMarkTradeComplete = async () => {
    if (!stepsCompleteFor(currentTradeIndex)) return;
    if (currentTradeIndex < tradeInstructions.length - 1) {
      setCurrentTradeIndex((i) => i + 1);
      return;
    }
    setApplying(true);
    try {
      const res = await api.rebalancing.apply(rec.id);
      setStrategyNote(res.strategy_note);
      setPhase('complete');
      toast.success('Portfolio aligned with your target');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not apply rebalance');
    } finally {
      setApplying(false);
    }
  };

  if (hidden) return null;

  const currentTrade = tradeInstructions[currentTradeIndex];
  const totalSteps = currentTrade?.steps?.length ?? 0;
  const doneCount =
    completedSteps[currentTradeIndex]?.length ?? 0;

  return (
    <div
      className={`rounded-2xl p-6 text-white relative overflow-hidden bg-gradient-to-br ${urgencyClass(rec.urgency)}`}
    >
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/5 rounded-full blur-2xl" />

      <div className="relative">
        <div
          className={`transition-opacity duration-300 ${contentMuted ? 'opacity-70' : ''}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 opacity-80" />
              <span className="text-sm font-medium opacity-80 capitalize">
                {rec.trigger_type?.replace('_', ' ') ?? 'Rebalance'}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white capitalize">
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
                        {t.ticker ??
                          (t.asset_class ? assetLabel(t.asset_class) : '—')}
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
        </div>

        <div className="relative mt-4 transition-all duration-300 space-y-3">
          {phase === 'recommendation' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPhase('choose_action')}
                className="px-4 py-2 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-gray-100 transition disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                Acknowledge
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPhase('choose_action')}
                className="px-4 py-2 bg-white/10 text-white rounded-full text-sm font-medium hover:bg-white/20 transition disabled:opacity-50 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Dismiss
              </button>
            </div>
          )}

          {phase === 'choose_action' && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <p className="text-sm font-semibold">
                What would you like to do with these trades?
              </p>
              <button
                type="button"
                disabled={loadingInstructions || busy}
                onClick={onChooseRebalanceForMe}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white rounded-lg py-3 font-semibold hover:bg-purple-500 transition disabled:opacity-50"
              >
                {loadingInstructions ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5 shrink-0" />
                )}
                <span className="text-left flex-1">
                  <span className="block">Rebalance for me</span>
                  <span className="block text-xs font-normal opacity-90 mt-0.5">
                    The AI will walk you through each trade step by step with
                    plain English instructions tailored to your brokerage,
                    then align your portfolio to your target mix.
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onRemindLater}
                className="w-full flex items-center justify-center gap-2 border border-white/40 bg-white/5 text-white rounded-lg py-3 mt-2 font-medium hover:bg-white/10 transition disabled:opacity-50"
              >
                <Clock className="w-5 h-5 shrink-0" />
                <span className="text-left flex-1">
                  <span className="block">Remind me later</span>
                  <span className="block text-xs font-normal opacity-80 mt-0.5">
                    We&apos;ll remind you in 24 hours. Your recommendation stays
                    open.
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onIllHandleIt}
                className="w-full text-center text-sm text-white/80 underline mt-1 py-2 hover:text-white transition disabled:opacity-50"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  <span className="text-left flex-1">
                    <span className="block font-medium">I&apos;ll handle it</span>
                    <span className="block text-xs font-normal opacity-80 mt-0.5 no-underline">
                      Dismiss this recommendation. You can always re-check from
                      the Rebalance page.
                    </span>
                  </span>
                </span>
              </button>
            </div>
          )}

          {phase === 'guided_trades' && tradeInstructions.length > 0 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <p className="text-sm font-semibold opacity-90">
                Follow each trade in your brokerage — then we&apos;ll align your
                portfolio here.
              </p>

              {tradeInstructions.map((trade, ti) => {
                const doneTrade = ti < currentTradeIndex;
                const active = ti === currentTradeIndex;
                const locked = ti > currentTradeIndex;
                if (locked) return null;

                return (
                  <div
                    key={`${trade.ticker}-${ti}`}
                    className="rounded-xl bg-black/25 border border-white/10 p-4"
                  >
                    {doneTrade ? (
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                        <span>
                          Trade {ti + 1} of {tradeInstructions.length}:{' '}
                          {tradeTitle(trade)}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="border-b border-white/15 pb-2 mb-3">
                          <p className="text-xs uppercase tracking-wide opacity-70">
                            Trade {ti + 1} of {tradeInstructions.length}
                          </p>
                          <p className="font-bold text-base">{tradeTitle(trade)}</p>
                          <p className="text-sm opacity-90 mt-1 tabular-nums">
                            Amount: {fmtMoney(trade.amount_dollars)}
                          </p>
                        </div>
                        <p className="text-xs opacity-80 mb-2">
                          Step {doneCount} of {totalSteps} complete
                        </p>
                        <p className="text-sm mb-3 leading-snug">
                          <span className="opacity-70">Why: </span>
                          {trade.plain_english_why}
                        </p>
                        <ul className="space-y-2 mb-3">
                          {(trade.steps ?? []).map((step, si) => {
                            const checked = (
                              completedSteps[ti] ?? []
                            ).includes(si);
                            return (
                              <li key={si}>
                                <button
                                  type="button"
                                  onClick={() => toggleStep(ti, si)}
                                  className="flex items-start gap-2 text-left text-sm w-full hover:opacity-95"
                                >
                                  <span className="mt-0.5 shrink-0">
                                    {checked ? '☑' : '☐'}
                                  </span>
                                  <span
                                    className={
                                      checked
                                        ? 'line-through opacity-70'
                                        : ''
                                    }
                                  >
                                    {si + 1}. {step}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        {trade.timing_note && (
                          <p className="text-[11px] opacity-75 mb-1">
                            {trade.timing_note}
                          </p>
                        )}
                        {trade.mutual_fund_note && (
                          <p className="text-[11px] opacity-75 mb-3">
                            {trade.mutual_fund_note}
                          </p>
                        )}
                        {stepsCompleteFor(ti) && (
                          <button
                            type="button"
                            disabled={applying}
                            onClick={onMarkTradeComplete}
                            className="w-full mt-2 py-2.5 rounded-lg bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {applying ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : null}
                            Mark trade complete →
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {phase === 'remind_confirmed' && (
            <div className="animate-in fade-in duration-300 space-y-3">
              <p className="flex items-start gap-2 text-sm">
                <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  Got it — we&apos;ll remind you tomorrow.
                  <span className="block mt-2 opacity-90">
                    Your recommendation stays open and will stay at the top of
                    your Rebalance page when you return.
                  </span>
                </span>
              </p>
              <button
                type="button"
                onClick={async () => {
                  await refresh();
                  setHidden(true);
                }}
                className="px-4 py-2 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          )}

          {phase === 'dismissed_confirmed' && (
            <div className="animate-in fade-in duration-300 space-y-3">
              <p className="flex items-start gap-2 text-sm">
                <Check className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  Sounds good.
                  <span className="block mt-2 opacity-90">
                    This recommendation has been dismissed. You can always
                    trigger a fresh rebalance check from &quot;Re-check now&quot; at the
                    top of this page.
                  </span>
                </span>
              </p>
              <button
                type="button"
                onClick={async () => {
                  await refresh();
                  setHidden(true);
                }}
                className="px-4 py-2 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          )}

          {phase === 'complete' && (
            <div className="animate-in fade-in duration-300 space-y-4">
              <div className="flex items-center gap-2 text-lg font-bold">
                <CheckCircle2 className="w-7 h-7 text-emerald-300" />
                All trades complete
              </div>
              <p className="text-sm opacity-95 leading-relaxed">
                Your portfolio has been aligned to your target allocation in
                FinanceIQ.{' '}
                {strategyNote ? (
                  <>
                    <span className="block mt-3 font-medium">{strategyNote}</span>
                  </>
                ) : null}
                <span className="block mt-3 opacity-90">
                  Prices will sync automatically — check back in a few minutes
                  for updated allocation.
                </span>
              </p>
              <button
                type="button"
                onClick={async () => {
                  await refresh();
                  setHidden(true);
                }}
                className="px-4 py-2 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-gray-100"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RebalanceTab({ data }: { data: PortfolioData }) {
  const { summary, recommendations, calibration, refresh } = data;
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
              <RecommendationCard key={rec.id} rec={rec} refresh={refresh} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
