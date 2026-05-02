export default function Logo({ size = 'md', className = '' }) {
  const sizes = {
    sm: { box: 'w-7 h-7 rounded-lg', text: 'text-base' },
    md: { box: 'w-9 h-9 rounded-xl', text: 'text-lg' },
    lg: { box: 'w-12 h-12 rounded-2xl', text: 'text-2xl' },
  }
  const s = sizes[size] || sizes.md
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`${s.box} relative inline-flex items-center justify-center bg-gradient-to-br from-brand-400 to-brand-700 shadow-glow`}
      >
        <span className="absolute inset-px rounded-[inherit] bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
        <svg viewBox="0 0 24 24" fill="none" className="w-1/2 h-1/2 relative">
          <path
            d="M4 17 L9 11 L13 14 L20 6"
            stroke="#04140d"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="6" r="2" fill="#04140d" />
        </svg>
      </span>
      <span className={`${s.text} font-semibold tracking-tight text-white`}>
        Finance<span className="text-brand-400">IQ</span>
      </span>
    </div>
  )
}
