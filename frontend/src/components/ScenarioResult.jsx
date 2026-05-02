import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardHeader } from './ui/Card'
import Stat from './ui/Stat'

export default function ScenarioResult({ result }) {
  if (!result) return null

  const {
    scenario,
    description,
    total_portfolio_before,
    total_portfolio_after,
    total_dollar_impact,
    total_pct_impact,
    holdings_breakdown,
    plain_english,
  } = result

  const isLoss = total_dollar_impact < 0

  const chartData = (holdings_breakdown || []).map(h => ({
    name: h.ticker || h.name,
    impact: parseFloat((h.dollar_change || 0).toFixed(0)),
  }))

  return (
    <Card className="p-6 relative overflow-hidden">
      <div
        className={`absolute -top-24 -right-20 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
          isLoss ? 'bg-rose-500/10' : 'bg-brand-500/10'
        }`}
      />
      <div className="relative">
        <CardHeader
          eyebrow="Scenario"
          title={scenario}
          description={description}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <Stat
            label="Portfolio Before"
            value={`$${(total_portfolio_before || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            accent="cyan"
          />
          <Stat
            label="Portfolio After"
            value={`$${(total_portfolio_after || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            accent={isLoss ? 'rose' : 'brand'}
          />
          <Stat
            label="Total Impact"
            value={
              <>
                <span className={isLoss ? 'text-rose-300' : 'text-brand-300'}>
                  {isLoss ? '−' : '+'}${Math.abs(total_dollar_impact || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-slate-500 text-sm font-normal ml-2">
                  ({Math.abs(total_pct_impact || 0).toFixed(1)}%)
                </span>
              </>
            }
            accent={isLoss ? 'rose' : 'brand'}
          />
        </div>

        <p className="text-slate-300 text-sm mt-6 leading-relaxed">{plain_english}</p>

        {chartData.length > 0 && (
          <div className="mt-6">
            <p className="section-eyebrow mb-3">Impact by Holding</p>
            <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 32)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  type="number"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={v => (v >= 1000 || v <= -1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#cbd5e1', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                  width={70}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{
                    background: 'rgba(10,14,23,0.92)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={v => [`$${Number(v).toLocaleString()}`, 'Impact']}
                />
                <Bar dataKey="impact" radius={[0, 6, 6, 0]} barSize={18}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.impact >= 0 ? '#34d399' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  )
}
