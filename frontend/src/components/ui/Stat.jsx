export default function Stat({ label, value, hint, accent = 'brand', icon }) {
  const accents = {
    brand: 'from-brand-500/20 to-brand-500/0 text-brand-300',
    violet: 'from-accent-violet/20 to-accent-violet/0 text-violet-300',
    cyan: 'from-accent-cyan/20 to-accent-cyan/0 text-cyan-300',
    amber: 'from-accent-amber/20 to-accent-amber/0 text-amber-300',
    rose: 'from-accent-rose/20 to-accent-rose/0 text-rose-300',
  }
  const ring = accents[accent] || accents.brand

  return (
    <div className="surface surface-hover p-4 relative overflow-hidden">
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${ring} blur-2xl opacity-60 pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="section-eyebrow">{label}</p>
          {icon && <span className="text-slate-500 text-sm">{icon}</span>}
        </div>
        <p className="text-white font-semibold text-2xl tabular-nums mt-2">{value ?? '—'}</p>
        {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
      </div>
    </div>
  )
}
