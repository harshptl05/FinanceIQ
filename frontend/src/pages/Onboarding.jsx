import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import Logo from '../components/ui/Logo'
import { Card } from '../components/ui/Card'
import {
  IconPalm,
  IconHome,
  IconCap,
  IconShield,
  IconTarget,
  IconArrow,
  IconCheck,
  IconX,
} from '../components/ui/Icons'

const STEPS = ['Goal', 'Timeline', 'Risk', 'Holdings', 'Account', 'Review']

const GOAL_TYPES = [
  { key: 'retirement', label: 'Retirement', Icon: IconPalm, desc: 'Build a nest egg for the future', tone: 'brand' },
  { key: 'house', label: 'Buy a Home', Icon: IconHome, desc: 'Save for a down payment', tone: 'cyan' },
  { key: 'college', label: 'College Fund', Icon: IconCap, desc: 'Save for education', tone: 'violet' },
  { key: 'emergency', label: 'Emergency Fund', Icon: IconShield, desc: '3–6 months of expenses', tone: 'amber' },
  { key: 'other', label: 'Other Goal', Icon: IconTarget, desc: 'Custom financial goal', tone: 'slate' },
]
const TONE_CLS = {
  brand: 'from-brand-400/30 to-brand-700/40 text-brand-300 ring-brand-500/30',
  cyan: 'from-cyan-400/30 to-cyan-700/40 text-cyan-300 ring-cyan-500/30',
  violet: 'from-violet-400/30 to-violet-700/40 text-violet-300 ring-violet-500/30',
  amber: 'from-amber-400/30 to-amber-700/40 text-amber-300 ring-amber-500/30',
  slate: 'from-white/10 to-white/5 text-slate-300 ring-white/10',
}

const ASSET_CLASSES = [
  { key: 'us_stocks', label: 'US Stocks / ETFs' },
  { key: 'intl_stocks', label: 'International Stocks' },
  { key: 'bonds', label: 'Bonds / Bond ETFs' },
  { key: 'cash', label: 'Cash / Money Market' },
  { key: 'real_estate', label: 'Real Estate / REITs' },
  { key: 'other', label: 'Other' },
]

const ACCOUNTS = [
  { key: '401k', label: '401(k)', desc: 'Employer-sponsored retirement plan — no taxes on trades' },
  { key: 'ira', label: 'Traditional IRA', desc: 'Tax-deferred retirement account' },
  { key: 'roth_ira', label: 'Roth IRA', desc: 'Tax-free growth and withdrawals' },
  { key: 'taxable', label: 'Taxable Brokerage', desc: 'Regular investment account — capital gains apply' },
  { key: 'other', label: 'Other', desc: 'HSA, 529, or other account type' },
]

function Pick({ active, children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
        active
          ? 'border-brand-500/40 bg-brand-500/10 text-brand-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
          : 'border-white/10 text-slate-300 hover:border-white/20 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    goal_type: '',
    goal_name: '',
    target_date: '',
    target_amount: '',
    income_stable: null,
    has_emergency_fund: null,
    risk_tolerance: 'moderate',
    holdings: [],
    account_type: 'taxable',
  })

  const [holdingInput, setHoldingInput] = useState({
    ticker: '',
    shares: '',
    avg_cost_basis: '',
    asset_class: 'us_stocks',
    name: '',
  })

  function update(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function addHolding() {
    if (!holdingInput.ticker || !holdingInput.shares) return
    update('holdings', [...form.holdings, { ...holdingInput }])
    setHoldingInput({ ticker: '', shares: '', avg_cost_basis: '', asset_class: 'us_stocks', name: '' })
  }

  async function finish() {
    setLoading(true)
    setError('')
    try {
      const goal = await api.goals.create({
        goal_type: form.goal_type,
        goal_name: form.goal_name || GOAL_TYPES.find(g => g.key === form.goal_type)?.label,
        target_date: form.target_date,
        target_amount: form.target_amount ? parseFloat(form.target_amount) : null,
        account_type: form.account_type,
        rebalancing_strategy: 'hybrid',
      })

      for (const h of form.holdings) {
        await api.holdings.create({
          ...h,
          goal_id: goal.id,
          shares: parseFloat(h.shares),
          avg_cost_basis: parseFloat(h.avg_cost_basis || 0),
        })
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const risk_capacity =
          form.income_stable && form.has_emergency_fund
            ? 'high'
            : !form.income_stable && !form.has_emergency_fund
            ? 'low'
            : 'medium'
        await supabase.from('user_profiles').upsert({
          id: session.user.id,
          risk_tolerance: form.risk_tolerance,
          risk_capacity,
        })
      }

      navigate('/dashboard')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const canContinue =
    (step === 0 && form.goal_type) ||
    (step === 1 && form.target_date) ||
    (step === 2 && form.income_stable !== null && form.has_emergency_fund !== null) ||
    step === 3 ||
    step === 4 ||
    step === 5

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-3xl bg-brand-500/10 pointer-events-none" />

      <div className="w-full max-w-xl relative">
        <div className="text-center mb-8">
          <Logo size="md" className="mx-auto" />
          <p className="text-slate-400 text-sm mt-3">Let's set up your portfolio — about 3 minutes</p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 text-[11px] tracking-wider uppercase">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={i <= step ? 'text-brand-300 font-semibold' : 'text-slate-600'}
              >
                {s}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition-all ${
                  i <= step
                    ? 'bg-gradient-to-r from-brand-300 to-brand-600 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : 'bg-white/5'
                }`}
              />
            ))}
          </div>
        </div>

        <Card className="p-7 md:p-8">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm p-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {/* Step 0: Goal */}
          {step === 0 && (
            <div>
              <h2 className="text-white text-xl font-bold tracking-tight">What are you investing for?</h2>
              <p className="text-slate-400 text-sm mt-1 mb-6">
                We'll set the right target allocation for your timeline.
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {GOAL_TYPES.map(({ key, label, Icon, desc, tone }) => {
                  const active = form.goal_type === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        update('goal_type', key)
                        update('goal_name', label)
                      }}
                      className={`flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'border-brand-500/40 bg-brand-500/8 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                          : 'border-white/8 hover:border-white/15 hover:bg-white/[0.025]'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${TONE_CLS[tone]} ring-1 flex items-center justify-center`}
                      >
                        <Icon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{label}</p>
                        <p className="text-slate-400 text-xs">{desc}</p>
                      </div>
                      {active && <IconCheck className="text-brand-300" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 1: Timeline */}
          {step === 1 && (
            <div>
              <h2 className="text-white text-xl font-bold tracking-tight">When do you need this money?</h2>
              <p className="text-slate-400 text-sm mt-1 mb-6">
                The further away, the more risk you can take. We'll automatically de-risk your allocation as you approach the date.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-400 text-xs block mb-2">Target date</label>
                  <input
                    type="date"
                    value={form.target_date}
                    onChange={e => update('target_date', e.target.value)}
                    className="field"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-2">Target amount (optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 500000"
                    value={form.target_amount}
                    onChange={e => update('target_amount', e.target.value)}
                    className="field"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Risk */}
          {step === 2 && (
            <div>
              <h2 className="text-white text-xl font-bold tracking-tight">Risk profile</h2>
              <p className="text-slate-400 text-sm mt-1 mb-6">
                We assess how you <em className="text-slate-300">feel</em> about risk and whether your finances can actually handle it.
              </p>
              <div className="space-y-5">
                <div>
                  <p className="text-slate-200 text-sm font-medium mb-3">
                    How comfortable are you seeing your portfolio drop 20% temporarily?
                  </p>
                  <div className="flex gap-2.5">
                    {[
                      ['conservative', 'Not at all'],
                      ['moderate', 'Somewhat'],
                      ['aggressive', 'Totally fine'],
                    ].map(([k, l]) => (
                      <Pick
                        key={k}
                        active={form.risk_tolerance === k}
                        onClick={() => update('risk_tolerance', k)}
                      >
                        {l}
                      </Pick>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-slate-200 text-sm font-medium mb-3">
                    Is your income stable? (salary / employment)
                  </p>
                  <div className="flex gap-2.5">
                    <Pick active={form.income_stable === true} onClick={() => update('income_stable', true)}>Yes</Pick>
                    <Pick active={form.income_stable === false} onClick={() => update('income_stable', false)}>
                      No / Variable
                    </Pick>
                  </div>
                </div>
                <div>
                  <p className="text-slate-200 text-sm font-medium mb-3">
                    Do you have a separate emergency fund (3–6 months of expenses)?
                  </p>
                  <div className="flex gap-2.5">
                    <Pick
                      active={form.has_emergency_fund === true}
                      onClick={() => update('has_emergency_fund', true)}
                    >
                      Yes
                    </Pick>
                    <Pick
                      active={form.has_emergency_fund === false}
                      onClick={() => update('has_emergency_fund', false)}
                    >
                      No
                    </Pick>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Holdings */}
          {step === 3 && (
            <div>
              <h2 className="text-white text-xl font-bold tracking-tight">What do you currently own?</h2>
              <p className="text-slate-400 text-sm mt-1 mb-6">
                Enter your existing investments. You can add more later.
              </p>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <input
                  value={holdingInput.ticker}
                  onChange={e => setHoldingInput(h => ({ ...h, ticker: e.target.value.toUpperCase() }))}
                  placeholder="Ticker (e.g. VTI)"
                  className="field font-mono"
                />
                <input
                  value={holdingInput.name}
                  onChange={e => setHoldingInput(h => ({ ...h, name: e.target.value }))}
                  placeholder="Name (optional)"
                  className="field"
                />
                <input
                  type="number"
                  value={holdingInput.shares}
                  onChange={e => setHoldingInput(h => ({ ...h, shares: e.target.value }))}
                  placeholder="# of shares"
                  className="field"
                />
                <input
                  type="number"
                  value={holdingInput.avg_cost_basis}
                  onChange={e => setHoldingInput(h => ({ ...h, avg_cost_basis: e.target.value }))}
                  placeholder="Avg cost / share"
                  className="field"
                />
                <select
                  value={holdingInput.asset_class}
                  onChange={e => setHoldingInput(h => ({ ...h, asset_class: e.target.value }))}
                  className="col-span-2 field"
                >
                  {ASSET_CLASSES.map(a => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={addHolding}
                className="w-full py-2.5 border border-dashed border-brand-500/40 text-brand-300 hover:bg-brand-500/10 rounded-xl text-sm font-medium transition-colors mb-4"
              >
                + Add holding
              </button>

              {form.holdings.length > 0 && (
                <div className="space-y-2">
                  {form.holdings.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white/[0.025] border border-white/[0.05] rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-brand-300 font-mono font-bold">{h.ticker}</span>
                        <span className="text-slate-300 text-sm truncate">
                          {h.shares} shares
                          {h.avg_cost_basis ? ` @ $${h.avg_cost_basis}` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => update('holdings', form.holdings.filter((_, j) => j !== i))}
                        className="text-slate-500 hover:text-rose-300 p-1 rounded-md hover:bg-white/5"
                      >
                        <IconX />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Account */}
          {step === 4 && (
            <div>
              <h2 className="text-white text-xl font-bold tracking-tight">Account type</h2>
              <p className="text-slate-400 text-sm mt-1 mb-6">
                Affects tax treatment when we recommend rebalancing.
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {ACCOUNTS.map(a => {
                  const active = form.account_type === a.key
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => update('account_type', a.key)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'border-brand-500/40 bg-brand-500/8 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                          : 'border-white/8 hover:border-white/15 hover:bg-white/[0.025]'
                      }`}
                    >
                      <div>
                        <p className="text-white font-medium">{a.label}</p>
                        <p className="text-slate-400 text-xs">{a.desc}</p>
                      </div>
                      {active && <IconCheck className="text-brand-300" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div>
              <h2 className="text-white text-xl font-bold tracking-tight">You're all set</h2>
              <p className="text-slate-400 text-sm mt-1 mb-6">
                Here's your setup. We'll start monitoring your portfolio immediately.
              </p>
              <div className="space-y-2.5 mb-6">
                {[
                  { label: 'Goal', value: form.goal_name },
                  { label: 'Target date', value: form.target_date },
                  { label: 'Account type', value: form.account_type?.replace(/_/g, ' ') },
                  { label: 'Risk tolerance', value: form.risk_tolerance },
                  {
                    label: 'Holdings',
                    value: `${form.holdings.length} position${form.holdings.length !== 1 ? 's' : ''}`,
                  },
                ].map(r => (
                  <div
                    key={r.label}
                    className="flex justify-between text-sm bg-white/[0.025] border border-white/[0.05] rounded-xl px-3 py-2.5"
                  >
                    <span className="text-slate-400">{r.label}</span>
                    <span className="text-white font-medium capitalize">{r.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="btn-ghost flex-1 py-3">
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canContinue}
                className="btn-primary flex-1 py-3"
              >
                Continue <IconArrow />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={loading}
                className="btn-primary flex-1 py-3"
              >
                {loading ? 'Setting up…' : (
                  <>
                    Launch dashboard <IconArrow />
                  </>
                )}
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
