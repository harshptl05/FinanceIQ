'use client';

import { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Bell,
  Newspaper,
  ExternalLink,
  Loader2,
  CheckCircle2,
  CheckCheck,
  ChevronDown,
} from 'lucide-react';
import type { PortfolioData } from '@/hooks/use-portfolio-data';
import { fmtMoney, relativeTime } from '@/lib/format';
import { EmptyState } from '@/components/data-state';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type Filter = 'all' | 'alerts' | 'news';

function urgencyClass(u?: string | null) {
  if (u === 'act_now') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (u === 'act_soon') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (u === 'monitor') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}

export function ActivityTab({ data }: { data: PortfolioData }) {
  const { alerts, news, refresh } = data;
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const unreadCount = alerts.filter((a) => !a.read).length;
  const counts = { all: alerts.length + news.length, alerts: alerts.length, news: news.length };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await Promise.all(
        alerts.filter((a) => !a.read).map((a) => api.alerts.markRead(a.id)),
      );
      await refresh();
      toast.success(`Marked ${unreadCount} alert${unreadCount === 1 ? '' : 's'} as read`);
    } catch {
      toast.error('Could not mark all as read');
    }
  };

  const items = useMemo(() => {
    type Item =
      | { kind: 'alert'; ts: number; data: (typeof alerts)[number] }
      | { kind: 'news'; ts: number; data: (typeof news)[number] };
    const result: Item[] = [];
    if (filter !== 'news') {
      for (const a of alerts) {
        result.push({ kind: 'alert', ts: new Date(a.created_at).getTime(), data: a });
      }
    }
    if (filter !== 'alerts') {
      for (const n of news) {
        const ts = new Date(n.processed_at ?? n.published_at ?? Date.now()).getTime();
        result.push({ kind: 'news', ts, data: n });
      }
    }
    return result.sort((a, b) => b.ts - a.ts);
  }, [alerts, news, filter]);

  const handleRefreshNews = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = (await api.news.refresh()) as {
        new?: number;
        fetched?: number;
        classification_started_in_background?: boolean;
      };
      await refresh();
      const added = result?.new ?? 0;
      if (added > 0) {
        toast.success(
          result?.classification_started_in_background
            ? `Pulled ${added} new headline${added === 1 ? '' : 's'}. Classifier running in the background.`
            : `Pulled ${added} new headline${added === 1 ? '' : 's'}.`,
        );
      } else {
        toast.message('No new headlines since the last pull.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setBusy(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.alerts.markRead(id);
      await refresh();
    } catch (e) {
      toast.error('Could not mark as read');
    }
  };

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-gray-500">
            Live alerts and headlines from the multi-agent pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-gray-100 rounded-full p-1">
            {(['all', 'alerts', 'news'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition flex items-center gap-1.5 ${
                  filter === f
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f}
                <span
                  className={`text-[10px] px-1.5 rounded-full tabular-nums ${
                    filter === f ? 'bg-white/20' : 'bg-gray-200'
                  }`}
                >
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-50 transition flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read ({unreadCount})
            </button>
          )}
          <button
            onClick={handleRefreshNews}
            disabled={busy}
            className="px-3 py-1.5 bg-black text-white rounded-full text-xs font-medium hover:bg-gray-800 transition flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
            Pull news
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        {items.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            description="Click 'Pull news' to fetch the latest headlines and run them through the classifier."
            action={
              <button
                onClick={handleRefreshNews}
                disabled={busy}
                className="px-4 py-2 bg-black text-white rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {busy ? 'Pulling…' : 'Pull latest news now'}
              </button>
            }
          />
        ) : (
          <div className="space-y-1">
            {items.map((item, idx) => {
              if (item.kind === 'alert') {
                const a = item.data;
                const positive = a.impact_classification === 'positive';
                const negative = a.impact_classification === 'negative';
                return (
                  <div
                    key={`a-${a.id}`}
                    className={`flex items-start gap-4 py-4 border-b border-gray-50 last:border-0 -mx-2 px-2 rounded-lg transition ${
                      a.read ? '' : 'bg-amber-50/40'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        positive
                          ? 'bg-green-50'
                          : negative
                            ? 'bg-rose-50'
                            : 'bg-blue-50'
                      }`}
                    >
                      {positive ? (
                        <TrendingUp className="w-6 h-6 text-green-600" />
                      ) : negative ? (
                        <TrendingDown className="w-6 h-6 text-rose-500" />
                      ) : (
                        <Bell className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">
                          {a.affected_holdings && a.affected_holdings.length > 0
                            ? a.affected_holdings.join(' · ')
                            : 'Portfolio impact alert'}
                        </p>
                        {a.urgency && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${urgencyClass(a.urgency)}`}
                          >
                            {a.urgency.replace('_', ' ')}
                          </span>
                        )}
                        {a.news_event_id ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified news
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                            Sample
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {a.plain_english_explanation ?? '—'}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => markRead(a.id)}
                          className="text-[11px] text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
                        >
                          Mark as read
                        </button>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {typeof a.estimated_dollar_impact === 'number' &&
                        a.estimated_dollar_impact !== 0 && (
                          <p
                            className={`font-bold tabular-nums ${
                              a.estimated_dollar_impact >= 0
                                ? 'text-green-600'
                                : 'text-rose-500'
                            }`}
                          >
                            {a.estimated_dollar_impact >= 0 ? '+' : '−'}
                            {fmtMoney(Math.abs(a.estimated_dollar_impact))}
                          </p>
                        )}
                      <p className="text-sm text-gray-400">
                        {relativeTime(a.created_at)}
                      </p>
                    </div>
                  </div>
                );
              }

              const n = item.data;
              const key = `n-${idx}`;
              const isOpen = expanded.has(key);
              return (
                <div
                  key={key}
                  className="border-b border-gray-50 last:border-0"
                >
                  <button
                    onClick={() => toggleExpand(key)}
                    className="w-full flex items-start gap-4 py-4 text-left rounded-lg -mx-2 px-2 hover:bg-gray-50 transition group"
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 shrink-0">
                      <Newspaper className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold group-hover:text-indigo-600 transition-colors">
                        {n.headline}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        {n.source ?? 'News'} ·{' '}
                        {relativeTime(n.published_at ?? n.processed_at)}
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 mt-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="ml-16 pb-4 -mt-1 flex items-center gap-3 text-xs text-gray-600">
                      <span>
                        Source:{' '}
                        <span className="font-medium">{n.source ?? '—'}</span>
                      </span>
                      <span className="text-gray-300">•</span>
                      <span>
                        Published:{' '}
                        <span className="font-medium">
                          {n.published_at
                            ? new Date(n.published_at).toLocaleString()
                            : 'unknown'}
                        </span>
                      </span>
                      {n.url && (
                        <>
                          <span className="text-gray-300">•</span>
                          <a
                            href={n.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            Open article <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
