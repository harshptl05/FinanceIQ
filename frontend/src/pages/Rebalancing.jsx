import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import RebalancingCard from '../components/RebalancingCard'
import { Card } from '../components/ui/Card'
import { IconCheck, IconRefresh, IconBalance } from '../components/ui/Icons'
import { api } from '../lib/api'

export default function Rebalancing() {
  const [recs, setRecs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([
        api.rebalancing.recommendations(),
        api.rebalancing.calibrationStats(),
      ])
      setRecs(r.recommendations || [])
      setStats(s)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function triggerCheck() {
    setChecking(true)
    try {
      await api.rebalancing.trigger()
      await refresh()
    } catch {}
    setChecking(false)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-8 py-6 border-b hairline flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="section-eyebrow">Optimization</p>
            <h1 className="text-white font-semibold text-2xl tracking-tight">Rebalancing</h1>
            <p className="text-slate-400 text-sm mt-1">
              Keep your portfolio aligned with your target allocation
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats && stats.accuracy_pct != null && (
              <div className="surface px-4 py-2.5">
                <p className="section-eyebrow">Recommendation Accuracy</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-brand-300 font-semibold text-2xl tabular-nums">
                    {stats.accuracy_pct}%
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    / {stats.total_evaluated} evaluated
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={triggerCheck}
              disabled={checking}
              className="btn-primary"
            >
              <IconRefresh className={checking ? 'animate-spin' : ''} />
              {checking ? 'Checking…' : 'Check Now'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-3xl mx-auto">
            {loading ? (
              <div className="space-y-4">
                {[0, 1].map(i => (
                  <div key={i} className="surface p-6 h-44">
                    <div className="skeleton h-4 w-40 mb-3" />
                    <div className="skeleton h-3 w-2/3 mb-5" />
                    <div className="skeleton h-full" />
                  </div>
                ))}
              </div>
            ) : recs.length > 0 ? (
              <div className="space-y-4">
                {recs.map(rec => (
                  <RebalancingCard key={rec.id} rec={rec} onStatusChange={refresh} />
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center max-w-lg mx-auto relative overflow-hidden">
                <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

                <div className="relative">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 ring-1 ring-brand-500/40 shadow-glow flex items-center justify-center text-ink-950 mb-4">
                    <IconCheck className="text-xl" />
                  </div>
                  <h2 className="text-white font-semibold text-xl mb-2">Portfolio is well-balanced</h2>
                  <p className="text-slate-400 text-sm">
                    No rebalancing needed right now — your portfolio is within your target bands.
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 text-[11px] text-slate-500 surface px-3 py-2">
                    <IconBalance className="text-brand-300" />
                    Regular rebalancing can add ~0.5–1% annual returns (Shannon's Demon).
                  </div>
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
