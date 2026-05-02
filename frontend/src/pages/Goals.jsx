import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { Card, CardHeader } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { IconPalm, IconHome, IconCap, IconShield, IconTarget } from '../components/ui/Icons'
import { api } from '../lib/api'

const GOAL_ICONS = {
  retirement: IconPalm,
  house: IconHome,
  college: IconCap,
  emergency: IconShield,
  other: IconTarget,
}
const GOAL_TONES = {
  retirement: 'brand',
  house: 'cyan',
  college: 'violet',
  emergency: 'amber',
  other: 'slate',
}

const ASSET_LABELS = {
  us_stocks: 'US Stocks',
  intl_stocks: 'Intl Stocks',
  bonds: 'Bonds',
  cash: 'Cash',
  real_estate: 'Real Estate',
  commodities: 'Commodities',
  other: 'Other',
}
const ASSET_COLORS = {
  us_stocks: '#34d399',
  intl_stocks: '#22d3ee',
  bonds: '#f59e0b',
  cash: '#8b5cf6',
  real_estate: '#f43f5e',
  commodities: '#38bdf8',
  other: '#94a3b8',
}

function CircularProgress({ pct = 0, size = 92, stroke = 8, color = '#34d399' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="16"
        fontWeight="600"
        fontFamily="JetBrains Mono, monospace"
      >
        {pct}%
      </text>
    </svg>
  )
}

function AllocationStrip({ alloc }) {
  const entries = Object.entries(alloc || {}).filter(([, v]) => v > 0)
  if (!entries.length) return <span className="text-slate-500 text-xs">Not set</span>
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1
  return (
    <div>
      <div className="h-2 rounded-full overflow-hidden flex bg-white/[0.04] ring-1 ring-white/[0.04]">
        {entries.map(([k, v]) => (
          <div
            key={k}
            style={{
              width: `${(v / total) * 100}%`,
              background: ASSET_COLORS[k] || '#94a3b8',
            }}
            title={`${ASSET_LABELS[k] || k}: ${(v * 100).toFixed(0)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
        {entries.map(([k, v]) => (
          <span key={k} className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: ASSET_COLORS[k] || '#94a3b8' }}
            />
            {ASSET_LABELS[k] || k} <span className="text-slate-500">{(v * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Goals() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const d = await api.goals.list()
      setGoals(d.goals || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  function yearsLeft(target_date) {
    if (!target_date) return null
    const diff = (new Date(target_date) - new Date()) / (365.25 * 86400000)
    return Math.max(0, diff)
  }

  function progressPct(goal) {
    const target = parseFloat(goal.target_amount || 0)
    if (!target) return null
    return Math.min(100, Math.round((parseFloat(goal.current_amount || 0) / target) * 100))
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-8 py-6 border-b hairline">
          <p className="section-eyebrow">Planning</p>
          <h1 className="text-white font-semibold text-2xl tracking-tight">Financial Goals</h1>
          <p className="text-slate-400 text-sm mt-1">Track every goal with its own glide path</p>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-5xl mx-auto">
            {loading ? (
              <div className="grid md:grid-cols-2 gap-5">
                {[0, 1].map(i => (
                  <div key={i} className="surface p-6 h-56">
                    <div className="skeleton h-4 w-32 mb-4" />
                    <div className="skeleton h-full" />
                  </div>
                ))}
              </div>
            ) : goals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {goals.map(g => {
                  const years = yearsLeft(g.target_date)
                  const pct = progressPct(g) ?? 0
                  const Icon = GOAL_ICONS[g.goal_type] || IconTarget
                  const tone = GOAL_TONES[g.goal_type] || 'slate'
                  const tonePillCls =
                    tone === 'brand'
                      ? 'from-brand-400/30 to-brand-700/40 text-brand-300 ring-brand-500/30'
                      : tone === 'cyan'
                      ? 'from-cyan-400/30 to-cyan-700/40 text-cyan-300 ring-cyan-500/30'
                      : tone === 'violet'
                      ? 'from-violet-400/30 to-violet-700/40 text-violet-300 ring-violet-500/30'
                      : tone === 'amber'
                      ? 'from-amber-400/30 to-amber-700/40 text-amber-300 ring-amber-500/30'
                      : 'from-white/10 to-white/5 text-slate-300 ring-white/10'

                  const ringColor =
                    tone === 'brand'
                      ? '#34d399'
                      : tone === 'cyan'
                      ? '#22d3ee'
                      : tone === 'violet'
                      ? '#8b5cf6'
                      : tone === 'amber'
                      ? '#f59e0b'
                      : '#cbd5e1'

                  return (
                    <Card key={g.id} className="p-6 surface-hover">
                      <div className="flex items-start gap-5">
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tonePillCls} ring-1 flex items-center justify-center text-lg shrink-0`}
                        >
                          <Icon />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-white font-semibold text-lg truncate">{g.goal_name}</h3>
                              <p className="text-slate-400 text-xs capitalize mt-0.5">
                                {g.goal_type} · {g.account_type?.replace(/_/g, ' ')}
                              </p>
                            </div>
                            {years !== null && (
                              <div className="text-right">
                                <p className="section-eyebrow">Time Left</p>
                                <p className="text-white font-semibold text-lg tabular-nums leading-tight">
                                  {years.toFixed(1)} <span className="text-slate-500 text-xs font-normal">yrs</span>
                                </p>
                              </div>
                            )}
                          </div>

                          {g.target_amount && (
                            <div className="mt-5 flex items-center gap-5">
                              <CircularProgress pct={pct} color={ringColor} />
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-400 text-xs">Progress to target</p>
                                <p className="text-white font-semibold tabular-nums text-lg">
                                  ${parseFloat(g.current_amount || 0).toLocaleString()}
                                </p>
                                <p className="text-slate-500 text-xs tabular-nums">
                                  of ${parseFloat(g.target_amount).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="mt-5">
                            <p className="section-eyebrow mb-2">Target Allocation</p>
                            <AllocationStrip alloc={g.target_allocation} />
                          </div>

                          <div className="mt-5 flex items-center justify-between text-[11px] text-slate-500 border-t hairline pt-3">
                            <span className="capitalize">
                              {g.rebalancing_strategy} · {g.rebalancing_frequency}
                            </span>
                            <Badge tone="slate">±{(g.rebalancing_threshold * 100).toFixed(0)}% band</Badge>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="p-12 text-center max-w-md mx-auto">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-brand-400/30 to-brand-700/40 ring-1 ring-brand-500/30 flex items-center justify-center text-brand-300 mb-4">
                  <IconTarget />
                </div>
                <p className="text-white font-semibold text-lg mb-2">No goals yet</p>
                <p className="text-slate-400 text-sm">
                  Complete onboarding to set your first financial goal and we'll generate a target allocation tailored to your timeline.
                </p>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
