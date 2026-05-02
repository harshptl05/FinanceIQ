import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, CardHeader } from './ui/Card'

const PERIODS = [
  { key: '1W', days: 7 },
  { key: '1M', days: 30 },
  { key: '3M', days: 90 },
  { key: '1Y', days: 365 },
  { key: 'ALL', days: null },
]

function filterByPeriod(history, days) {
  if (!history?.length) return []
  if (days == null) return history
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  return history.filter(d => d.snapshot_date >= cutoff)
}

function formatDateTick(s) {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function PortfolioChart({ history }) {
  const [period, setPeriod] = useState('1M')
  const days = PERIODS.find(p => p.key === period)?.days

  const data = useMemo(
    () =>
      filterByPeriod(history, days).map(d => ({
        date: d.snapshot_date,
        value: parseFloat(d.total_value || 0),
      })),
    [history, days]
  )

  const first = data[0]?.value || 0
  const last = data[data.length - 1]?.value || 0
  const isUp = last >= first
  const stroke = isUp ? '#34d399' : '#f43f5e'
  const periodChange = first > 0 ? ((last - first) / first) * 100 : 0

  return (
    <Card className="p-6 h-full flex flex-col">
      <CardHeader
        eyebrow="Performance"
        title="Portfolio Value Over Time"
        description={
          data.length > 0 ? (
            <>
              {period}{' '}
              <span className={isUp ? 'text-brand-300' : 'text-rose-300'}>
                {isUp ? '+' : ''}
                {periodChange.toFixed(2)}%
              </span>
              <span className="text-slate-600 ml-2">
                · {data.length} snapshot{data.length === 1 ? '' : 's'}
              </span>
            </>
          ) : (
            <span className="text-slate-600">No snapshots in window</span>
          )
        }
        action={
          <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-lg p-1">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-colors ${
                  period === p.key
                    ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.key}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 min-h-[240px] mt-4">
        {data.length < 2 ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <div>
              <p className="text-slate-300 text-sm font-medium">Not enough data yet</p>
              <p className="text-slate-500 text-xs mt-1 max-w-xs">
                Hit <span className="text-slate-200 font-medium">Sync Prices</span> to record
                your first snapshot. Daily snapshots will appear here as the portfolio sync
                agent runs.
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickFormatter={formatDateTick}
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                width={48}
                domain={['auto', 'auto']}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}
                contentStyle={{
                  background: 'rgba(10,14,23,0.92)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  fontSize: 12,
                  backdropFilter: 'blur(8px)',
                }}
                labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                labelFormatter={v =>
                  new Date(v).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                }
                formatter={v => [
                  `$${Number(v).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                  'Value',
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={stroke}
                strokeWidth={2}
                fill="url(#portfolioFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: stroke }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
