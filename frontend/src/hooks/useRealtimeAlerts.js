import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useRealtimeAlerts(userId, onNewAlert) {
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('portfolio_alerts_' + userId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'portfolio_alerts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onNewAlert(payload.new)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userId, onNewAlert])
}
