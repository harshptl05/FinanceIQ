import { Link } from 'react-router-dom'
import Logo from '../components/ui/Logo'
import Badge from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import {
  IconSparkle,
  IconBalance,
  IconScenario,
  IconShield,
  IconArrow,
  IconBell,
} from '../components/ui/Icons'

const FEATURES = [
  {
    icon: IconSparkle,
    title: 'Plain-English AI Advisor',
    desc: 'Ask anything in everyday language. Answers grounded in your real holdings — no jargon, no generic advice.',
    tone: 'brand',
  },
  {
    icon: IconBalance,
    title: 'Smart Rebalancing',
    desc: 'Threshold, calendar, hybrid, and cashflow strategies — with tax-loss harvesting flagged automatically.',
    tone: 'cyan',
  },
  {
    icon: IconScenario,
    title: 'Historical Stress Tests',
    desc: 'Replay your portfolio against the 2008 crash, COVID, the 2022 rate hikes, and more — see the real dollar impact.',
    tone: 'violet',
  },
  {
    icon: IconBell,
    title: 'Verified Alerts',
    desc: 'Live news pipeline + Claude classifier — alerts only fire when something real moves your specific holdings.',
    tone: 'amber',
  },
  {
    icon: IconShield,
    title: 'Risk Capacity, Not Just Tolerance',
    desc: "We assess what your finances can survive — not just what you say you're comfortable with.",
    tone: 'rose',
  },
]

const toneCls = {
  brand: 'from-brand-400/30 to-brand-700/40 text-brand-300 ring-brand-500/30',
  cyan: 'from-cyan-400/30 to-cyan-700/40 text-cyan-300 ring-cyan-500/30',
  violet: 'from-violet-400/30 to-violet-700/40 text-violet-300 ring-violet-500/30',
  amber: 'from-amber-400/30 to-amber-700/40 text-amber-300 ring-amber-500/30',
  rose: 'from-rose-400/30 to-rose-700/40 text-rose-300 ring-rose-500/30',
}

export default function Landing() {
  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden">
      {/* Hero gradient mesh */}
      <div className="absolute inset-0 bg-mesh-hero pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-3xl bg-brand-500/15 pointer-events-none" />

      <header className="relative flex items-center justify-between px-6 md:px-8 py-5 border-b hairline backdrop-blur-md">
        <Logo size="md" />
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-slate-300 hover:text-white px-4 py-2 text-sm">
            Log in
          </Link>
          <Link to="/login" className="btn-primary">
            Get Started <IconArrow />
          </Link>
        </div>
      </header>

      <main className="relative flex-1 flex flex-col items-center px-6 py-16 md:py-24">
        <div className="max-w-3xl text-center">
          <Badge tone="brand" className="!text-xs !px-3 !py-1" dot>
            HackUTD 2025 — Goldman Sachs Challenge
          </Badge>
          <h2 className="mt-6 text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            The financial advisor{' '}
            <span className="bg-gradient-to-br from-brand-300 via-brand-400 to-brand-600 bg-clip-text text-transparent">
              90% of Americans
            </span>
            <br />
            can't afford.
          </h2>
          <p className="mt-6 text-slate-400 text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
            FinanceIQ speaks plain English, watches your money 24/7, and stops you from making
            emotional decisions. Powered by Claude.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="btn-primary text-base px-6 py-3">
              Start for free <IconArrow />
            </Link>
            <a href="#features" className="btn-ghost text-base px-6 py-3">
              See how it works
            </a>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 chip">
            <span className="live-dot" /> Live news + Claude classification
          </div>
        </div>

        {/* Mock dashboard preview */}
        <div className="relative mt-16 md:mt-24 w-full max-w-5xl">
          <div className="absolute -inset-1 bg-gradient-to-br from-brand-500/40 via-violet-500/30 to-cyan-500/30 rounded-[2rem] blur-2xl opacity-40 pointer-events-none" />
          <div className="relative surface p-1 rounded-3xl">
            <div className="rounded-[1.4rem] overflow-hidden border hairline bg-ink-950/80">
              <div className="px-5 py-3 border-b hairline flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-brand-400/80" />
                <span className="text-[11px] text-slate-500 ml-3 font-mono">financeiq.app/dashboard</span>
              </div>
              <div className="p-6 grid grid-cols-3 gap-4">
                <div className="col-span-2 surface p-5">
                  <p className="section-eyebrow">Portfolio Value</p>
                  <p className="text-white text-3xl font-bold tabular-nums mt-1">$127,430.00</p>
                  <p className="text-brand-300 text-xs mt-1 tabular-nums">▲ $1,234.56 today (+0.97%)</p>
                  <div className="mt-5 h-24 rounded-lg relative overflow-hidden">
                    <svg viewBox="0 0 300 80" preserveAspectRatio="none" className="w-full h-full">
                      <defs>
                        <linearGradient id="ll" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,55 C40,50 60,42 90,38 C120,34 140,46 170,40 C200,34 220,22 250,18 C275,14 290,12 300,10 L300,80 L0,80 Z"
                        fill="url(#ll)"
                      />
                      <path
                        d="M0,55 C40,50 60,42 90,38 C120,34 140,46 170,40 C200,34 220,22 250,18 C275,14 290,12 300,10"
                        stroke="#34d399"
                        strokeWidth="1.8"
                        fill="none"
                      />
                    </svg>
                  </div>
                </div>
                <div className="surface p-5">
                  <p className="section-eyebrow">Allocation</p>
                  <div className="space-y-3 mt-3">
                    {[
                      { l: 'US Stocks', cur: 64, tgt: 60, c: '#34d399' },
                      { l: 'Intl Stocks', cur: 18, tgt: 15, c: '#22d3ee' },
                      { l: 'Bonds', cur: 13, tgt: 20, c: '#f59e0b' },
                      { l: 'Cash', cur: 5, tgt: 5, c: '#8b5cf6' },
                    ].map(r => (
                      <div key={r.l}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-200">{r.l}</span>
                          <span className="text-slate-500 font-mono">{r.cur}% / {r.tgt}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                          <div style={{ width: `${r.cur}%`, background: r.c }} className="h-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="mt-24 w-full max-w-6xl">
          <div className="text-center mb-10">
            <p className="section-eyebrow">What's inside</p>
            <h3 className="text-white text-3xl md:text-4xl font-bold mt-2 tracking-tight">
              The whole stack — built right.
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc, tone }) => (
              <Card key={title} className="p-6 surface-hover relative overflow-hidden">
                <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full blur-2xl bg-gradient-to-br ${toneCls[tone]} opacity-30 pointer-events-none`} />
                <div className="relative">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${toneCls[tone]} ring-1 flex items-center justify-center text-base mb-4`}>
                    <Icon />
                  </div>
                  <h4 className="text-white font-semibold text-base mb-1.5">{title}</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative text-center py-6 text-slate-600 text-xs border-t hairline">
        Built for HackUTD 2025 — Goldman Sachs "Empowering the Everyday Investor" Challenge
      </footer>
    </div>
  )
}
