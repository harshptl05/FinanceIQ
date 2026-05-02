'use client';

import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  PiggyBank,
  Bell,
  Scale,
  Wallet,
  AlertTriangle,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { PortfolioData } from '@/hooks/use-portfolio-data';
import { useAuth } from '@/lib/auth-context';
import { fmtMoney, fmtPct, relativeTime } from '@/lib/format';
import { EmptyState } from '@/components/data-state';
import { toast } from 'sonner';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function urgencyClass(u?: string | null) {
  if (u === 'act_now') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (u === 'act_soon') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (u === 'monitor') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}

export function DashboardTab({ data }: { data: PortfolioData }) {
  const { user } = useAuth();
  const {
    summary,
    history,
    alerts,
    holdings,
    recommendations,
    pricesSynced,
    syncPrices,
  } = data;

  const [syncing, setSyncing] = useState(false);
  const [refreshingNews, setRefreshingNews] = useState(false);

  const totalValue = summary?.total_value ?? 0;
  const cash = holdings
    .filter((h) => h.asset_class === 'cash')
    .reduce((acc, h) => acc + Number(h.current_value ?? 0), 0);

  // Today change = last snapshot vs previous
  const today = (() => {
    if (history.length < 2) return null;
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const dollar = Number(last.total_value) - Number(prev.total_value);
    const pct = Number(prev.total_value) > 0 ? (dollar / Number(prev.total_value)) * 100 : 0;
    return { dollar, pct };
  })();

  const totalReturns = holdings.reduce((acc, h) => {
    const cv = Number(h.current_value ?? 0);
    const cost = Number(h.shares ?? 0) * Number(h.avg_cost_basis ?? 0);
    return acc + (cv - cost);
  }, 0);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncPrices();
      toast.success('Prices synced from Yahoo Finance');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Sync failed — is the backend running?',
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleRefreshNews = async () => {
    if (refreshingNews) return;
    setRefreshingNews(true);
    try {
      const { api } = await import('@/lib/api');
      await api.news.refresh();
      await data.refresh();
      toast.success('Pulled latest news + ran classifier');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'News refresh failed',
      );
    } finally {
      setRefreshingNews(false);
    }
  };

  const userName =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
    user?.email?.split('@')[0] ??
    'there';

  return (
    <>
      {/* Welcome */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold capitalize">
            {greeting()}, {userName}
          </h1>
          <p className="text-gray-500">Here&apos;s your portfolio at a glance.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4" />
            )}
            Sync prices
          </button>
          <button
            onClick={handleRefreshNews}
            disabled={refreshingNews}
            className="px-4 py-2 border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {refreshingNews ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            Pull news
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20">
          <p className="text-sm opacity-80">Total Portfolio Value</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {fmtMoney(totalValue)}
          </p>
          <div className="flex items-center gap-1 mt-2 text-sm">
            {today ? (
              <>
                {today.dollar >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>
                  {today.dollar >= 0 ? '+' : '−'}
                  {fmtMoney(Math.abs(today.dollar))} ({fmtPct(today.pct, { decimals: 2 })}) today
                </span>
              </>
            ) : (
              <span className="opacity-80">Need ≥2 snapshots for daily change</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">Available Cash</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{fmtMoney(cash)}</p>
          <p className="text-xs text-gray-400 mt-2">From your cash holdings</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">Unrealized Gain / Loss</p>
          <p
            className={`text-2xl font-bold mt-1 tabular-nums ${
              totalReturns >= 0 ? 'text-green-600' : 'text-rose-500'
            }`}
          >
            {totalReturns >= 0 ? '+' : '−'}
            {fmtMoney(Math.abs(totalReturns))}
          </p>
          <p className="text-xs text-gray-400 mt-2">vs. cost basis</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">Sharpe Ratio</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {summary?.sharpe_ratio?.toFixed(2) ?? '—'}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Expected return per unit of risk
          </p>
        </div>
      </div>

      {/* Sync hint */}
      {!pricesSynced && holdings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Prices not synced yet</p>
            <p className="text-amber-800/80 mt-0.5">
              Click <span className="font-semibold">Sync prices</span> above to pull live
              prices from Yahoo Finance. Until then, holdings show $0.
            </p>
          </div>
        </div>
      )}

      {/* Recent activity (alerts + recommendations) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent activity</h2>
            <span className="text-[11px] text-gray-400">
              {alerts.length} unread alert{alerts.length === 1 ? '' : 's'}
            </span>
          </div>

          {alerts.length === 0 && recommendations.length === 0 ? (
            <EmptyState
              title="All quiet"
              description="No alerts or rebalancing recommendations right now. The pipeline checks news every 5 minutes."
            />
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 4).map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      a.impact_classification === 'positive'
                        ? 'bg-green-50'
                        : a.impact_classification === 'negative'
                          ? 'bg-rose-50'
                          : 'bg-blue-50'
                    }`}
                  >
                    {a.impact_classification === 'positive' ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : a.impact_classification === 'negative' ? (
                      <TrendingDown className="w-5 h-5 text-rose-500" />
                    ) : (
                      <Bell className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">
                        {a.affected_holdings && a.affected_holdings.length > 0
                          ? a.affected_holdings.join(' · ')
                          : 'Portfolio update'}
                      </p>
                      {a.urgency && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${urgencyClass(a.urgency)}`}
                        >
                          {a.urgency.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                      {a.plain_english_explanation ?? '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {typeof a.estimated_dollar_impact === 'number' &&
                      a.estimated_dollar_impact !== 0 && (
                        <p
                          className={`font-semibold text-sm tabular-nums ${
                            a.estimated_dollar_impact >= 0
                              ? 'text-green-600'
                              : 'text-rose-500'
                          }`}
                        >
                          {a.estimated_dollar_impact >= 0 ? '+' : '−'}
                          {fmtMoney(Math.abs(a.estimated_dollar_impact))}
                        </p>
                      )}
                    <p className="text-xs text-gray-400">{relativeTime(a.created_at)}</p>
                  </div>
                </div>
              ))}

              {recommendations.slice(0, 2).map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 shrink-0">
                    <Scale className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      Rebalancing recommendation
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                      {r.plain_english_explanation ?? r.trigger_description ?? '—'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">
                    {relativeTime(r.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSync}
              className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center"
            >
              <RefreshCcw className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
              <span className="text-sm font-medium">Sync prices</span>
            </button>
            <button
              onClick={handleRefreshNews}
              className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center"
            >
              <Bell className="w-6 h-6 mx-auto mb-2 text-amber-600" />
              <span className="text-sm font-medium">Pull news</span>
            </button>
            <button className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center">
              <PiggyBank className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <span className="text-sm font-medium">Goals</span>
            </button>
            <button className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <span className="text-sm font-medium">Ask AI</span>
            </button>
          </div>

          <div className="mt-5 p-3 bg-gradient-to-br from-gray-900 to-indigo-900 rounded-xl text-white">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 opacity-80" />
              <span className="text-[11px] opacity-80">Holdings</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {summary?.holdings_count ?? holdings.length}
            </p>
            <p className="text-[11px] opacity-70 mt-0.5">
              Across {data.goals.length} goal
              {data.goals.length === 1 ? '' : 's'}
            </p>
            {data.news[0]?.url && (
              <a
                href={data.news[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] mt-2 flex items-center gap-1 text-indigo-200 hover:text-white"
              >
                Latest headline <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
