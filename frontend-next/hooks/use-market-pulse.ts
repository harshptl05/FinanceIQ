'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type PulseItem } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export type TriggerResult = {
  /** True if at least one new pulse item appeared after the trigger. */
  newItems: boolean;
  /** Total count after the trigger settled. */
  count: number;
  /** Whether the news pipeline ran successfully. */
  pipelineOk: boolean;
  /** Error message if the pipeline failed. */
  error?: string;
};

export type UseMarketPulse = {
  items: PulseItem[];
  loading: boolean;
  /** True when a realtime channel is open and we just got an INSERT. */
  flash: boolean;
  /** Cheap re-fetch from /news/pulse. Doesn't run the classifier. */
  refresh: () => Promise<void>;
  /** True while the heavyweight pipeline trigger is running. */
  triggering: boolean;
  /** Run /news/refresh (ingestion + classifier) and poll for new pulse items. */
  triggerRefresh: () => Promise<TriggerResult>;
};

/**
 * Live-updating feed of news events that materially affect THIS user.
 *
 * We don't subscribe to news_events directly — we subscribe to portfolio_alerts
 * because those are the events the classifier already filtered down to "this
 * actually moved the user's holdings". When a new alert lands, we re-pull
 * /news/pulse so the headline / source / url are joined in.
 */
export function useMarketPulse(limit: number = 4): UseMarketPulse {
  const { user, session } = useAuth();
  const [items, setItems] = useState<PulseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef<PulseItem[]>([]);
  itemsRef.current = items;

  const refresh = useCallback(async (): Promise<PulseItem[] | null> => {
    if (!session) return null;
    try {
      const { pulse } = await api.news.pulse(limit);
      const list = pulse ?? [];
      setItems(list);
      return list;
    } catch {
      // network blips are fine; keep what we already have
      return null;
    } finally {
      setLoading(false);
    }
  }, [session, limit]);

  // Public-facing refresh wrapper that returns void to match the type.
  const refreshVoid = useCallback(async (): Promise<void> => {
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Heavyweight refresh — kicks off the news ingestion + classifier pipeline
  // server-side, then polls /news/pulse for new items because classification
  // runs in a background task. We poll up to ~10s before giving up.
  const triggerRefresh = useCallback(async (): Promise<TriggerResult> => {
    if (!session) {
      return { newItems: false, count: 0, pipelineOk: false, error: 'Not signed in' };
    }
    setTriggering(true);
    const baselineIds = new Set(itemsRef.current.map((i) => i.id));
    try {
      try {
        await api.news.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Pipeline failed';
        // Even if /news/refresh errors, try to re-pull existing alerts so
        // a partial result is still shown.
        await refresh();
        return {
          newItems: false,
          count: itemsRef.current.length,
          pipelineOk: false,
          error: msg,
        };
      }

      // Poll: 0ms, 1.5s, 3s, 4.5s, 6s, 8s. Total ~8s — long enough for the
      // classifier to finish its background pass on a typical 5-headline batch
      // without making the user wait too long.
      const waits = [0, 1500, 1500, 1500, 1500, 2000];
      let latest: PulseItem[] = itemsRef.current;
      for (const wait of waits) {
        if (wait) await new Promise((r) => setTimeout(r, wait));
        const fresh = await refresh();
        if (!fresh) continue;
        latest = fresh;
        const hasNew = fresh.some((i) => !baselineIds.has(i.id));
        if (hasNew) break;
      }
      const newItems = latest.some((i) => !baselineIds.has(i.id));
      return {
        newItems,
        count: latest.length,
        pipelineOk: true,
      };
    } finally {
      setTriggering(false);
    }
  }, [session, refresh]);

  // Realtime subscription. Supabase's postgres_changes filter only supports
  // simple eq, so we subscribe with `user_id=eq.<uid>` and refetch on any
  // INSERT to that user's row.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`market_pulse_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'portfolio_alerts',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refresh();
          setFlash(true);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlash(false), 1800);
        },
      )
      .subscribe();

    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  return {
    items,
    loading,
    flash,
    refresh: refreshVoid,
    triggering,
    triggerRefresh,
  };
}
