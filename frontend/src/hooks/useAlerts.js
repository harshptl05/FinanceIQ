import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

export function useAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api.alerts.list()
      setAlerts(data.alerts || [])
    } catch {}
    setLoading(false)
  }, [])

  const markRead = useCallback(async (id) => {
    await api.alerts.markRead(id)
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { alerts, loading, refresh, markRead }
}
