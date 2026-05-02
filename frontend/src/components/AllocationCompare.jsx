import { Link } from 'react-router-dom'
import { Card, CardHeader } from './ui/Card'
import { IconArrow } from './ui/Icons'

const LABELS = {
  us_stocks: 'US Stocks',
  intl_stocks: 'Intl Stocks',
  bonds: 'Bonds',
  cash: 'Cash',
  real_estate: 'Real Estate',
  commodities: 'Commodities',
  other: 'Other',
}

const COLORS = {
  us_stocks: '#34d399',
  intl_stocks: '#22d3ee',
  bonds: '#f59e0b',
  cash: '#8b5cf6',
  real_estate: '#f43f5e',
  commodities: '#38bdf8',
  other: '#94a3b8',
}

function pct(v) {
  return Math.round((v || 0) * 1000) / 10
}

export default function AllocationCompare({ current = {}, target = {}, threshold = 0.05 }) {
  const keys = Array.from(
    new Set([...Object.keys(current), ...Object.keys(target)])
  ).filter(k => (current[k] || 0) > 0.001 || (target[k] || 0) > 0.001)

  if (keys.length === 0) {
    return (
      <Card className="p-6 h-full flex flex-col">
        <CardHeader eyebrow="Allocation" title="No holdings yet" />
        <p className="text-slate-500 text-sm mt-3">
          Add holdings during onboarding to see your allocation here.
        </p>
      </Card>
    )
  }

  keys.sort((a, b) => (current[b] || 0) - (current[a] || 0))

  const driftRows = keys.filter(k => Math.abs((current[k] || 0) - (target[k] || 0)) > threshold).length

  return (
    <Card className="p-6 h-full flex flex-col">
      <CardHeader
        eyebrow="Allocation"
        title="Current vs Target"
        description={
          driftRows > 0
            ? `${driftRows} class${driftRows === 1 ? '' : 'es'} outside ±${Math.round(threshold * 100)}% band`
            : `All within ±${Math.round(threshold * 100)}% band`
        }
        action={
          <Link
            to="/dashboard/rebalance"
            className="text-xs text-brand-300 hover:text-brand-200 inline-flex items-center gap-1"
          >
            Rebalance <IconArrow className="text-[11px]" />
          </Link>
        }
      />

      <div className="space-y-4 flex-1 mt-5">
        {keys.map(k => {
          const cur = current[k] || 0
          const tgt = target[k] || 0
          const drift = cur - tgt
          const overband = Math.abs(drift) > threshold
          const color = COLORS[k] || '#94a3b8'

          const max = Math.max(cur, tgt, 0.01)
          const curW = `${(cur / max) * 100}%`
          const tgtMarker = `${(tgt / max) * 100}%`

          const driftSign = drift > 0 ? '+' : ''
          const driftClass = !drift
            ? 'text-slate-500'
            : overband
            ? 'text-amber-300'
            : 'text-slate-400'

          return (
            <div key={k}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-100 font-medium">{LABELS[k] || k}</span>
                <span className="text-slate-400 tabular-nums font-mono">
                  {pct(cur).toFixed(1)}%{' '}
                  <span className="text-slate-600">/ {pct(tgt).toFixed(1)}%</span>
                  <span className={`ml-2 ${driftClass}`}>
                    {driftSign}{pct(drift).toFixed(1)}%
                  </span>
                </span>
              </div>
              <div className="relative h-2.5 bg-white/[0.04] rounded-full overflow-hidden ring-1 ring-white/[0.04]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: curW,
                    background: `linear-gradient(90deg, ${color}cc, ${color})`,
                    boxShadow: overband
                      ? `0 0 10px ${color}66`
                      : 'none',
                  }}
                />
                {/* Target marker line */}
                <div
                  className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-white/80 rounded-full"
                  style={{ left: tgtMarker }}
                  title={`Target ${pct(tgt).toFixed(1)}%`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
