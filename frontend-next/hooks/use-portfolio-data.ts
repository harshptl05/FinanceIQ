'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type Holding,
  type Goal,
  type Alert,
  type NewsEvent,
  type PortfolioSnapshot,
  type PortfolioSummary,
  type Recommendation,
  type CalibrationStats,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLivePrices } from '@/lib/live-prices';

export type PortfolioData = {
  loading: boolean;
  error: string | null;
  summary: PortfolioSummary | null;
  history: PortfolioSnapshot[];
  holdings: Holding[];
  goals: Goal[];
  alerts: Alert[];
  news: NewsEvent[];
  recommendations: Recommendation[];
  calibration: CalibrationStats | null;
  pricesSynced: boolean;
  refresh: () => Promise<void>;
  syncPrices: () => Promise<void>;
};

export function usePortfolioData(): PortfolioData {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [news, setNews] = useState<NewsEvent[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [calibration, setCalibration] = useState<CalibrationStats | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [s, h, hist, g, a, n, r, c] = await Promise.allSettled([
        api.portfolio.summary(),
        api.holdings.list(),
        api.portfolio.history(),
        api.goals.list(),
        api.alerts.list(),
        api.news.recent(20),
        api.rebalancing.recommendations(),
        api.rebalancing.calibrationStats(),
      ]);

      if (s.status === 'fulfilled') setSummary(s.value);
      if (h.status === 'fulfilled') setHoldings(h.value.holdings ?? []);
      if (hist.status === 'fulfilled') setHistory(hist.value.history ?? []);
      if (g.status === 'fulfilled') setGoals(g.value.goals ?? []);
      if (a.status === 'fulfilled') setAlerts(a.value.alerts ?? []);
      if (n.status === 'fulfilled') setNews(n.value.news ?? []);
      if (r.status === 'fulfilled')
        setRecommendations(r.value.recommendations ?? []);
      if (c.status === 'fulfilled') setCalibration(c.value);

      const failures = [s, h, hist, g, a, n, r, c].filter(
        (x) => x.status === 'rejected',
      ) as PromiseRejectedResult[];
      if (failures.length === 8) {
        setError('Could not reach the FinanceIQ API. Is the backend running on :8000?');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const syncPrices = useCallback(async () => {
    await api.holdings.syncPrices();
    await refresh();
  }, [refresh]);

  const pricesSynced = holdings.some(
    (h) => Number(h.current_price ?? 0) > 0 && Number(h.current_value ?? 0) > 0,
  );

  // ---- Live-price overlay ----
  // When the MarketChart simulation is running, push the simulated tick
  // prices through holdings so current_value, summary.total_value, P&L,
  // and allocation %s all refresh in sync with the chart. When no live
  // ticks have arrived for a ticker yet, we leave the API price intact.
  const { prices: livePrices, isLive, pruneToTickers } = useLivePrices();

  useEffect(() => {
    pruneToTickers(holdings.map((h) => h.ticker));
  }, [holdings, pruneToTickers]);

  const overlaidHoldings = useMemo<Holding[]>(() => {
    if (!isLive || Object.keys(livePrices).length === 0) return holdings;
    return holdings.map((h) => {
      const t = h.ticker;
      const live =
        livePrices[t] ??
        livePrices[t.toUpperCase()] ??
        livePrices[t.toLowerCase()];
      if (!live || !h.shares) return h;
      const shares = Number(h.shares);
      return {
        ...h,
        current_price: live,
        current_value: shares * live,
      };
    });
  }, [holdings, livePrices, isLive]);

  const overlaidSummary = useMemo<PortfolioSummary | null>(() => {
    if (!summary) return summary;
    if (!isLive || Object.keys(livePrices).length === 0) return summary;
    const total = overlaidHoldings.reduce(
      (acc, h) => acc + Number(h.current_value ?? 0),
      0,
    );
    if (Math.abs(total - Number(summary.total_value ?? 0)) < 0.01) return summary;
    return { ...summary, total_value: total };
  }, [summary, overlaidHoldings, livePrices, isLive]);

  return {
    loading,
    error,
    summary: overlaidSummary,
    history,
    holdings: overlaidHoldings,
    goals,
    alerts,
    news,
    recommendations,
    calibration,
    pricesSynced,
    refresh,
    syncPrices,
  };
}
