import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import ScenarioResult from '../components/ScenarioResult'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { IconScenario } from '../components/ui/Icons'
import { api } from '../lib/api'

export default function Scenarios() {
  const [scenarios, setScenarios] = useState([])
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.scenarios.list().then(d => setScenarios(d.scenarios || [])).catch(() => {})
  }, [])

  async function runScenario(key) {
    setSelected(key)
    setLoading(true)
    setResult(null)
    try {
      const r = await api.scenarios.run({ scenario_key: key })
      setResult(r)
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-8 py-6 border-b hairline">
          <p className="section-eyebrow">Stress Test</p>
          <h1 className="text-white font-semibold text-2xl tracking-tight">Scenario Simulator</h1>
          <p className="text-slate-400 text-sm mt-1">
            Replay your portfolio against historical market events
          </p>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {scenarios.map(s => {
                const isActive = selected === s.key
                return (
                  <button
                    key={s.key}
                    onClick={() => runScenario(s.key)}
                    disabled={loading}
                    className={`group surface surface-hover p-5 text-left relative overflow-hidden transition-all ${
                      isActive
                        ? 'ring-1 ring-brand-500/50 shadow-glow'
                        : ''
                    }`}
                  >
                    {isActive && (
                      <div className="absolute -top-12 -right-12 w-40 h-40 bg-brand-500/15 rounded-full blur-2xl pointer-events-none" />
                    )}
                    <div className="relative">
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ring-1 ${
                            isActive
                              ? 'bg-brand-500/20 text-brand-300 ring-brand-500/40'
                              : 'bg-white/[0.04] text-slate-400 ring-white/[0.06] group-hover:text-white'
                          }`}
                        >
                          <IconScenario />
                        </div>
                        <Badge tone="slate">{s.duration_months}mo</Badge>
                      </div>
                      <h3 className="text-white font-semibold text-base mb-1.5">{s.name}</h3>
                      <p className="text-slate-400 text-xs leading-relaxed">{s.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {loading && (
              <Card className="p-10 flex flex-col items-center justify-center">
                <div className="flex items-center gap-3 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0.15s' }} />
                  <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
                  <span className="text-sm">Running scenario…</span>
                </div>
              </Card>
            )}

            {result && !loading && <ScenarioResult result={result} />}

            {!result && !loading && (
              <Card className="p-10 text-center max-w-lg mx-auto">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-violet-400/30 to-violet-700/40 ring-1 ring-violet-500/30 flex items-center justify-center text-violet-300 mb-4">
                  <IconScenario />
                </div>
                <p className="text-white font-semibold text-base">Pick a scenario above</p>
                <p className="text-slate-400 text-sm mt-1.5">
                  We'll replay it against your current holdings and show the dollar impact per position.
                </p>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
