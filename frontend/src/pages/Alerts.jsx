import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AlertCard from '../components/AlertCard'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { IconBell, IconRefresh } from '../components/ui/Icons'
import { useAlerts } from '../hooks/useAlerts'
import { api } from '../lib/api'

function fmtRelative(iso) {
  if (!iso) return 'never'
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60) return `${Math.round(diff)}s ago`
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    return `${Math.round(diff / 86400)}d ago`
  } catch {
    return '—'
  }
}

export default function Alerts() {
  const { alerts, loading, refresh, markRead } = useAlerts()
  const [status, setStatus] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState(null)

  useEffect(() => {
    api.news.status().then(setStatus).catch(() => {})
  }, [])

  async function refreshNews() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const r = await api.news.refresh()
      setRefreshMsg(
        r.new > 0
          ? `Pulled ${r.fetched} headlines, ${r.new} new — running classifier…`
          : `Pulled ${r.fetched} headlines, no new events.`
      )
      setTimeout(async () => {
        await refresh()
        const s = await api.news.status().catch(() => null)
        if (s) setStatus(s)
      }, 1500)
    } catch (e) {
      setRefreshMsg(`Refresh failed: ${e.message}`)
    } finally {
      setRefreshing(false)
    }
  }

  const lastEvent = status?.last_event_time
  const verified = alerts.filter(a => a.news_event_id).length
  const sample = alerts.length - verified

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-8 py-6 border-b hairline flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="section-eyebrow">Monitoring</p>
            <h1 className="text-white font-semibold text-2xl tracking-tight">Portfolio Alerts</h1>
            <p className="text-slate-400 text-sm mt-1 flex items-center gap-2 flex-wrap">
              <span>{alerts.length} unread</span>
              {verified > 0 && (
                <Badge tone="brand" dot>
                  {verified} from live news
                </Badge>
              )}
              {sample > 0 && (
                <Badge tone="amber" dot>
                  {sample} sample
                </Badge>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="surface px-3 py-2 hidden md:block">
              <p className="section-eyebrow">Last news event</p>
              <p className="text-slate-200 text-sm font-medium tabular-nums">{fmtRelative(lastEvent)}</p>
            </div>
            <button onClick={refreshNews} disabled={refreshing} className="btn-ghost">
              <IconRefresh className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh news'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-3xl mx-auto">
            {refreshMsg && (
              <div className="mb-4 text-xs text-slate-300 surface px-3 py-2.5 flex items-center gap-2">
                <span className="live-dot" />
                {refreshMsg}
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="surface p-5 h-24">
                    <div className="skeleton h-3 w-32 mb-3" />
                    <div className="skeleton h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map(a => (
                  <AlertCard key={a.id} alert={a} onMarkRead={markRead} />
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center max-w-md mx-auto">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-brand-400/30 to-brand-700/40 ring-1 ring-brand-500/30 flex items-center justify-center text-brand-300 mb-4">
                  <IconBell />
                </div>
                <p className="text-white font-semibold text-lg mb-2">All clear</p>
                <p className="text-slate-400 text-sm">
                  We're watching the market. Alerts only appear here when a real news event materially affects your specific holdings — nothing fabricated.
                </p>
                <button
                  onClick={refreshNews}
                  disabled={refreshing}
                  className="mt-5 btn-ghost mx-auto"
                >
                  <IconRefresh className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'Refreshing…' : 'Pull latest news now'}
                </button>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
