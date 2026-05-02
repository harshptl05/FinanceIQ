export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`surface ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ eyebrow, title, action, description, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="section-eyebrow mb-1">{eyebrow}</p>}
        {title && <h2 className="text-white text-base font-semibold">{title}</h2>}
        {description && <p className="text-slate-400 text-xs mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className = '', children }) {
  return <div className={className}>{children}</div>
}
