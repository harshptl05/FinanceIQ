'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type PulseItem } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export type UseMarketPulse = {
  items: PulseItem[];
  loading: boolean;
  /** True when a realtime channel is open and we just got an INSERT. */
  flash: boolean;
  refresh: () => Promise<void>;
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
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const { pulse } = await api.news.pulse(limit);
      setItems(pulse ?? []);
    } catch {
      // network blips are fine; keep what we already have
    } finally {
      setLoading(false);
    }
  }, [session, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  return { items, loading, flash, refresh };
}
