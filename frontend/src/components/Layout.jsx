import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { LayoutDashboard, LogOut, UserCircle } from 'lucide-react'
import NotificationBell from './NotificationBell'

function Avatar({ size = 'h-8 w-8', textSize = 'text-xs', name, avatarUrl }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'

  if (avatarUrl) return <img src={avatarUrl} alt={name} className={`${size} rounded-full object-cover border border-white/20 shadow-md`} />
  return <div className={`${size} rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center ${textSize} font-medium text-white shadow-md`}>{initials}</div>
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const location = useLocation()

  const nav = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/profile', label: 'Profile', icon: UserCircle },
  ]

  return (
    <div className="app-canvas flex h-screen">
      {/* â”€â”€ Glass Sidebar â”€â”€ */}
      <aside className="w-60 glass-strong flex flex-col border-r border-white/5 relative z-10">
        <div className="p-5 border-b border-white/5">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/geply-logo.png" alt="Geply" className="h-9 w-auto group-hover:scale-105 transition-transform" />
            <span className="font-display text-[22px] text-white tracking-tight">Geply</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'glass-brand text-white font-medium'
                    : 'text-secondary hover:bg-white/5 hover:text-white'
                }`}>
                <Icon className="h-[16px] w-[16px]" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User card at bottom */}
        <div className="p-3 border-t border-white/5">
          <Link to="/profile" className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/5 rounded-lg transition-colors">
            <Avatar size="h-9 w-9" textSize="text-xs" name={user?.full_name} avatarUrl={user?.avatar_url} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-tertiary truncate">{user?.email}</p>
            </div>
            <button onClick={(e) => { e.preventDefault(); logout() }}
              className="p-1.5 text-tertiary hover:text-danger hover:bg-white/5 rounded-md transition-colors" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </aside>

      {/* â”€â”€ Main content column â”€â”€ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 glass border-b border-white/5 flex items-center justify-end px-6 shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link to="/profile">
              <Avatar size="h-9 w-9" textSize="text-xs" name={user?.full_name} avatarUrl={user?.avatar_url} />
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    </div>
  )
}