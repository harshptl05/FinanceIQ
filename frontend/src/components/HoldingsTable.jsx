import { Card, CardHeader } from './ui/Card'
import Badge from './ui/Badge'

const ASSET_LABELS = {
  us_stocks: 'US Stocks',
  intl_stocks: 'Intl Stocks',
  bonds: 'Bonds',
  cash: 'Cash',
  real_estate: 'Real Estate',
  commodities: 'Commodities',
  other: 'Other',
}

const ASSET_TONE = {
  us_stocks: 'brand',
  intl_stocks: 'cyan',
  bonds: 'amber',
  cash: 'violet',
  real_estate: 'rose',
  commodities: 'cyan',
  other: 'slate',
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function HoldingsTable({ holdings }) {
  const sorted = [...(holdings || [])].sort(
    (a, b) => (parseFloat(b.current_value) || 0) - (parseFloat(a.current_value) || 0)
  )
  const total = sorted.reduce((s, h) => s + (parseFloat(h.current_value) || 0), 0)
  const hasPrices = sorted.some(h => parseFloat(h.current_price) > 0)

  return (
    <Card className="p-6">
      <CardHeader
        eyebrow="Positions"
        title="Holdings"
        description={`${sorted.length} position${sorted.length === 1 ? '' : 's'}`}
        action={
          !hasPrices && sorted.length > 0 ? (
            <Badge tone="amber" dot>Prices not synced</Badge>
          ) : null
        }
      />

      {sorted.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-400 text-sm">No holdings yet</p>
          <p className="text-slate-600 text-xs mt-1">
            Complete onboarding to add your portfolio.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2 mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="text-left font-medium py-2 px-3">Ticker</th>
                <th className="text-left font-medium py-2 px-3">Name</th>
                <th className="text-left font-medium py-2 px-3 hidden md:table-cell">Class</th>
                <th className="text-right font-medium py-2 px-3">Value</th>
                <th className="text-right font-medium py-2 px-3">Weight</th>
                <th className="text-right font-medium py-2 px-3 hidden lg:table-cell">Shares</th>
                <th className="text-right font-medium py-2 px-3">Price</th>
                <th className="text-right font-medium py-2 px-3 hidden md:table-cell">Gain / Loss</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => {
                const value = parseFloat(h.current_value) || 0
                const price = parseFloat(h.current_price) || 0
                const shares = parseFloat(h.shares) || 0
                const cost = parseFloat(h.avg_cost_basis) || 0
                const weight = total > 0 ? (value / total) * 100 : 0
                const gain = (price - cost) * shares
                const gainPct = cost > 0 ? ((price - cost) / cost) * 100 : 0
                const gainClass =
                  gain > 0 ? 'text-brand-300' : gain < 0 ? 'text-rose-300' : 'text-slate-500'

                return (
                  <tr
                    key={h.id}
                    className="border-t hairline hover:bg-white/[0.025] transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-semibold text-brand-300">{h.ticker}</td>
                    <td className="py-3 px-3 text-slate-100 max-w-[200px] truncate">
                      {h.name || h.ticker}
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell">
                      <Badge tone={ASSET_TONE[h.asset_class] || 'slate'}>
                        {ASSET_LABELS[h.asset_class] || h.asset_class}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right text-white tabular-nums font-medium">
                      ${fmtMoney(value)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400 tabular-nums">
                      {weight.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400 tabular-nums hidden lg:table-cell font-mono">
                      {shares.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300 tabular-nums font-mono">
                      ${price.toFixed(2)}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums hidden md:table-cell ${gainClass}`}>
                      {price > 0 && cost > 0 ? (
                        <>
                          {gain >= 0 ? '+' : ''}${fmtMoney(Math.abs(gain))}
                          <span className="text-xs ml-1 opacity-80">
                            ({gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
