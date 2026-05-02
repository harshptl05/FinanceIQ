import { NavLink, useNavigate } from 'react-router-dom'
import { useAlerts } from '../hooks/useAlerts'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import Logo from './ui/Logo'
import {
  IconOverview,
  IconGoals,
  IconBell,
  IconChat,
  IconBalance,
  IconScenario,
} from './ui/Icons'

const NAV = [
  { to: '/dashboard', label: 'Overview', Icon: IconOverview, exact: true },
  { to: '/dashboard/goals', label: 'Goals', Icon: IconGoals },
  { to: '/dashboard/alerts', label: 'Alerts', Icon: IconBell, badgeKey: 'alerts' },
  { to: '/dashboard/chat', label: 'AI Advisor', Icon: IconChat },
  { to: '/dashboard/rebalance', label: 'Rebalance', Icon: IconBalance },
  { to: '/dashboard/scenarios', label: 'Scenarios', Icon: IconScenario },
]

export default function Sidebar() {
  const { alerts } = useAlerts()
  const { user } = useAuth()
  const navigate = useNavigate()
  const unread = alerts.length

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const initials = (user?.email || '?')
    .split('@')[0]
    .split(/[._\-+]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || '?'

  return (
    <aside className="w-60 shrink-0 flex flex-col px-4 py-5 border-r hairline bg-ink-950/60 backdrop-blur-md relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" />

      <div className="px-2 mb-1">
        <Logo size="sm" />
      </div>
      <p className="text-slate-500 text-[11px] tracking-wide px-2 mb-7">Your AI Financial Advisor</p>

      <nav className="flex-1 flex flex-col gap-0.5">
        {NAV.map(({ to, label, Icon, badgeKey, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `group relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'text-white bg-white/5 ring-1 ring-white/10 shadow-glass'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-brand-300 to-brand-600 shadow-[0_0_12px_rgba(16,185,129,0.55)]" />
                )}
                <span className="flex items-center gap-3">
                  <Icon
                    className={`text-base ${
                      isActive ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span>{label}</span>
                </span>
                {badgeKey === 'alerts' && unread > 0 && (
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer card */}
      <div className="mt-4 surface p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-ink-950 font-bold text-xs shadow-glow shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">
              {user?.email || 'Guest'}
            </p>
            <p className="text-slate-500 text-[10px] flex items-center gap-1.5">
              <span className="live-dot" /> Live monitoring
            </p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="text-slate-500 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/5"
          >
            ↗
          </button>
        </div>
      </div>
    </aside>
  )
}
