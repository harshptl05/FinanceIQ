const TONES = {
  brand: 'bg-brand-500/12 text-brand-300 border-brand-500/30',
  violet: 'bg-violet-500/12 text-violet-300 border-violet-500/30',
  cyan: 'bg-cyan-500/12 text-cyan-300 border-cyan-500/30',
  amber: 'bg-amber-500/12 text-amber-300 border-amber-500/30',
  rose: 'bg-rose-500/12 text-rose-300 border-rose-500/30',
  slate: 'bg-white/5 text-slate-300 border-white/10',
}

export default function Badge({ tone = 'slate', className = '', children, dot = false }) {
  const cls = TONES[tone] || TONES.slate
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${tone === 'brand' ? 'bg-brand-400' : tone === 'amber' ? 'bg-amber-400' : tone === 'rose' ? 'bg-rose-400' : tone === 'violet' ? 'bg-violet-400' : tone === 'cyan' ? 'bg-cyan-400' : 'bg-slate-400'}`} />}
      {children}
    </span>
  )
}
