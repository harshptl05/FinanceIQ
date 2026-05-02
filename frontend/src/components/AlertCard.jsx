import Badge from './ui/Badge'
import { IconX } from './ui/Icons'

const URGENCY_TONE = {
  act_now: 'rose',
  act_soon: 'amber',
  monitor: 'cyan',
  info_only: 'slate',
}
const URGENCY_LABEL = {
  act_now: 'Act Now',
  act_soon: 'Act Soon',
  monitor: 'Monitor',
  info_only: 'Info',
}

function fmtTime(t) {
  if (!t) return '—'
  try {
    const d = new Date(t)
    const now = new Date()
    const mins = Math.round((now - d) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.round(hrs / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

export default function AlertCard({ alert, onMarkRead, source }) {
  const urgency = alert.urgency || 'info_only'
  const tone = URGENCY_TONE[urgency] || 'slate'
  const impact = alert.impact_classification || 'neutral'
  const dollar = parseFloat(alert.estimated_dollar_impact) || 0
  const tickers = (alert.affected_holdings || []).filter(Boolean)
  const verified = !!alert.news_event_id

  const impactClass =
    impact === 'positive' ? 'text-brand-300' : impact === 'negative' ? 'text-rose-300' : 'text-slate-400'

  return (
    <div className="surface surface-hover p-5 group">
      <div className="flex items-start gap-4">
        <div
          className={`mt-0.5 w-1 self-stretch rounded-full ${
            tone === 'rose'
              ? 'bg-gradient-to-b from-rose-300 to-rose-600 shadow-[0_0_10px_rgba(244,63,94,0.45)]'
              : tone === 'amber'
              ? 'bg-gradient-to-b from-amber-300 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.45)]'
              : tone === 'cyan'
              ? 'bg-gradient-to-b from-cyan-300 to-cyan-600 shadow-[0_0_10px_rgba(34,211,238,0.45)]'
              : 'bg-white/15'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <Badge tone={tone} dot>{URGENCY_LABEL[urgency]}</Badge>
            {dollar !== 0 && (
              <span className={`text-xs font-medium tabular-nums font-mono ${impactClass}`}>
                {dollar > 0 ? '+' : '−'}${Math.abs(dollar).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            )}
            {tickers.length > 0 && (
              <span className="text-xs text-slate-500 font-mono">
                · {tickers.slice(0, 4).join(', ')}{tickers.length > 4 ? '…' : ''}
              </span>
            )}
            {!verified && (
              <Badge tone="amber" className="ml-auto !text-[10px]">Sample · not from live news</Badge>
            )}
          </div>

          <p className="text-slate-100 text-sm leading-relaxed">
            {alert.plain_english_explanation || 'No explanation available.'}
          </p>

          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            <span>{fmtTime(alert.created_at)}</span>
            {source?.url ? (
              <>
                <span className="text-slate-700">·</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-300 hover:text-brand-200 truncate max-w-xs"
                  title={source.headline}
                >
                  {source.source || 'Source'}
                </a>
              </>
            ) : verified ? (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-slate-500">News-pipeline alert</span>
              </>
            ) : null}
          </div>
        </div>

        {onMarkRead && (
          <button
            onClick={() => onMarkRead(alert.id)}
            title="Dismiss"
            className="text-slate-500 hover:text-white text-xs flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/5"
          >
            <IconX />
          </button>
        )}
      </div>
    </div>
  )
}
