import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

export function usePortfolio() {
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [sum, hist, hold] = await Promise.all([
        api.portfolio.summary(),
        api.portfolio.history(),
        api.holdings.list(),
      ])
      setSummary(sum)
      setHistory(hist.history || [])
      setHoldings(hold.holdings || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  return { summary, history, holdings, loading, error, refresh }
}
