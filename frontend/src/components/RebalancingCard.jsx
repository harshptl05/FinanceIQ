import { Card } from './ui/Card'
import Badge from './ui/Badge'
import { IconCheck, IconX } from './ui/Icons'
import { api } from '../lib/api'

const URGENCY_TONE = {
  act_now: 'rose',
  act_soon: 'amber',
  monitor: 'cyan',
}
const URGENCY_LABEL = {
  act_now: 'Act Now',
  act_soon: 'Act Soon',
  monitor: 'Monitor',
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

export default function RebalancingCard({ rec, onStatusChange }) {
  const tone = URGENCY_TONE[rec.urgency] || 'cyan'
  const trades = rec.recommended_trades || []

  async function handleStatus(status) {
    await api.rebalancing.updateStatus(rec.id, status)
    onStatusChange?.()
  }

  return (
    <Card className="p-6 surface-hover">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="section-eyebrow">{rec.trigger_type?.replace(/_/g, ' ') || 'Recommendation'}</p>
          <h3 className="text-white font-semibold text-lg mt-0.5 truncate">
            {rec.goal_name || 'Portfolio Rebalancing'}
          </h3>
          <p className="text-slate-400 text-sm">{rec.trigger_description}</p>
        </div>
        <Badge tone={tone} dot>{URGENCY_LABEL[rec.urgency] || 'Monitor'}</Badge>
      </div>

      <p className="text-slate-200 text-sm leading-relaxed mb-4">{rec.plain_english_explanation}</p>

      {rec.tax_notes && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 mb-5 text-xs text-amber-200">
          <span className="font-semibold text-amber-300">Tax note · </span>
          {rec.tax_notes}
        </div>
      )}

      {trades.length > 0 && (
        <div className="mb-5">
          <p className="section-eyebrow mb-2.5">Recommended Trades</p>
          <div className="space-y-2">
            {trades.map((t, i) => {
              const isBuy = (t.action || '').toLowerCase() === 'buy'
              return (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white/[0.025] border border-white/[0.05] rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                        isBuy
                          ? 'bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30'
                          : 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'
                      }`}
                    >
                      {isBuy ? '+' : '−'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium">
                        {(t.action || '').toUpperCase()}{' '}
                        <span className="text-slate-300 capitalize font-normal">
                          {ASSET_LABELS[t.asset_class] || t.asset_class || t.ticker || ''}
                        </span>
                      </p>
                      <p className="text-slate-500 text-xs truncate">{t.reason}</p>
                    </div>
                  </div>
                  <span className="text-white font-mono tabular-nums text-sm shrink-0">
                    ${(t.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t hairline">
        <button onClick={() => handleStatus('acted')} className="btn-primary flex-1">
          <IconCheck /> Mark as Acted
        </button>
        <button onClick={() => handleStatus('acknowledged')} className="btn-ghost flex-1">
          Acknowledge
        </button>
        <button
          onClick={() => handleStatus('dismissed')}
          className="btn-ghost px-3"
          title="Dismiss"
        >
          <IconX />
        </button>
      </div>
    </Card>
  )
}
