import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePortfolio } from '../hooks/usePortfolio'
import { useAlerts } from '../hooks/useAlerts'
import { useRealtimeAlerts } from '../hooks/useRealtimeAlerts'
import Sidebar from '../components/Sidebar'
import PortfolioChart from '../components/PortfolioChart'
import AllocationCompare from '../components/AllocationCompare'
import HoldingsTable from '../components/HoldingsTable'
import AlertCard from '../components/AlertCard'
import { Card, CardHeader } from '../components/ui/Card'
import Stat from '../components/ui/Stat'
import Badge from '../components/ui/Badge'
import { IconRefresh, IconArrow, IconBell } from '../components/ui/Icons'
import { api } from '../lib/api'

function fmtMoney(v, opts = {}) {
  return Number(v || 0).toLocaleString('en-US', {
    minimumFractionDigits: opts.minFrac ?? 2,
    maximumFractionDigits: opts.maxFrac ?? 2,
  })
}

function fmtRelative(iso) {
  if (!iso) return null
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60) return `${Math.round(diff)}s ago`
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    return `${Math.round(diff / 86400)}d ago`
  } catch {
    return null
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const { summary, history, holdings, loading, refresh } = usePortfolio()
  const { alerts, markRead } = useAlerts()
  const [notification, setNotification] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState(null)

  const onNewAlert = useCallback(
    alert => {
      setNotification(alert.plain_english_explanation)
      setTimeout(() => setNotification(null), 8000)
      refresh()
    },
    [refresh]
  )

  useRealtimeAlerts(user?.id, onNewAlert)

  const { changeAmt, changePct, hasChange, lastSnapDate } = useMemo(() => {
    if (!summary || !history?.length) return { changeAmt: 0, changePct: 0, hasChange: false }
    const last = history[history.length - 1]
    const prev = [...history].reverse().find(h => h.snapshot_date !== last.snapshot_date)
    if (!prev) return { changeAmt: 0, changePct: 0, hasChange: false, lastSnapDate: last?.snapshot_date }
    const lastVal = parseFloat(last.total_value) || summary.total_value
    const prevVal = parseFloat(prev.total_value) || lastVal
    const amt = lastVal - prevVal
    const pct = prevVal > 0 ? (amt / prevVal) * 100 : 0
    return { changeAmt: amt, changePct: pct, hasChange: true, lastSnapDate: last.snapshot_date }
  }, [summary, history])

  const totalValue = summary?.total_value || 0
  const needsSync = holdings.some(h => !h.current_price || parseFloat(h.current_price) === 0)

  async function handleSync() {
    setSyncing(true)
    try {
      await api.holdings.syncPrices()
      await refresh()
      setSyncedAt(new Date().toISOString())
    } catch (e) {
      console.error('Sync failed', e)
    } finally {
      setSyncing(false)
    }
  }

  const upToken = changeAmt >= 0
  const changeBadge = hasChange ? (
    <Badge tone={upToken ? 'brand' : 'rose'} dot>
      {upToken ? '▲' : '▼'} ${fmtMoney(Math.abs(changeAmt))} ({upToken ? '+' : '−'}
      {Math.abs(changePct).toFixed(2)}%)
    </Badge>
  ) : (
    <Badge tone="slate">Need ≥2 snapshots</Badge>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-8 py-6 border-b hairline relative">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="section-eyebrow">Portfolio Value</span>
                {needsSync && (
                  <Badge tone="amber" dot>Prices not synced</Badge>
                )}
              </div>
              <div className="flex items-baseline gap-4 flex-wrap">
                <h1 className="text-white text-4xl md:text-5xl font-bold tabular-nums tracking-tight">
                  ${fmtMoney(totalValue)}
                </h1>
                <span className="text-sm">{changeBadge}</span>
              </div>
              {lastSnapDate && (
                <p className="text-xs text-slate-500 mt-2">
                  Last snapshot{' '}
                  <span className="text-slate-300">
                    {new Date(lastSnapDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {summary && (
                <div className="text-right hidden md:block px-3 py-2 surface">
                  <p className="section-eyebrow">Expected Return</p>
                  <p className="text-brand-300 font-semibold tabular-nums text-lg">
                    {summary.expected_annual_return}% / yr
                  </p>
                </div>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn-ghost"
                title="Pull latest prices from Yahoo Finance"
              >
                <IconRefresh className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync Prices'}
              </button>
            </div>
          </div>
          {syncedAt && (
            <p className="text-xs text-slate-600 mt-3">Synced {fmtRelative(syncedAt)} from Yahoo Finance</p>
          )}
        </header>

        {/* Real-time notification */}
        {notification && (
          <div className="bg-brand-500/10 border-b border-brand-500/20 px-8 py-3 text-brand-200 text-sm flex items-center gap-3 backdrop-blur-md">
            <IconBell className="text-brand-300" />
            <span className="flex-1">{notification}</span>
            <button onClick={() => setNotification(null)} className="text-brand-200 hover:text-white px-2">
              ✕
            </button>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 md:px-8 py-6">
          {loading ? (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 surface p-6 h-[300px]">
                  <div className="skeleton h-4 w-40 mb-4" />
                  <div className="skeleton h-full" />
                </div>
                <div className="surface p-6 h-[300px]">
                  <div className="skeleton h-4 w-32 mb-4" />
                  <div className="skeleton h-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="surface p-4 h-24"><div className="skeleton h-full" /></div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Performance + Allocation */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                  <PortfolioChart history={history} />
                </div>
                <AllocationCompare
                  current={summary?.current_allocation}
                  target={summary?.target_allocation}
                  threshold={0.05}
                />
              </div>

              {/* Stats */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat
                    label="Sharpe Ratio"
                    value={summary.sharpe_ratio?.toFixed(2)}
                    hint="Return per unit of risk"
                    accent="brand"
                  />
                  <Stat
                    label="Volatility"
                    value={`${summary.portfolio_volatility}%`}
                    hint="Estimated annual stdev"
                    accent="violet"
                  />
                  <Stat
                    label="Holdings"
                    value={summary.holdings_count}
                    hint="Distinct positions"
                    accent="cyan"
                  />
                  <Stat
                    label="Expected Return"
                    value={`${summary.expected_annual_return}%`}
                    hint="Weighted long-run"
                    accent="amber"
                  />
                </div>
              )}

              {/* Holdings */}
              <HoldingsTable holdings={holdings} />

              {/* Alerts */}
              {alerts.length > 0 ? (
                <Card className="p-6">
                  <CardHeader
                    eyebrow="Recent"
                    title="Portfolio Alerts"
                    description={`${alerts.length} unread · only events that materially affect your holdings appear here`}
                    action={
                      <Link
                        to="/dashboard/alerts"
                        className="text-brand-300 hover:text-brand-200 text-sm inline-flex items-center gap-1"
                      >
                        View all <IconArrow className="text-[11px]" />
                      </Link>
                    }
                  />
                  <div className="space-y-3 mt-4">
                    {alerts.slice(0, 3).map(a => (
                      <AlertCard key={a.id} alert={a} onMarkRead={markRead} />
                    ))}
                  </div>
                </Card>
              ) : (
                <Card className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">No alerts right now</p>
                    <p className="text-slate-500 text-xs mt-1 max-w-md">
                      The news pipeline will only post here when something real moves your specific holdings.
                    </p>
                  </div>
                  <Link
                    to="/dashboard/alerts"
                    className="btn-ghost"
                  >
                    Pull news <IconArrow />
                  </Link>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
