import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { LayoutDashboard, LogOut, Briefcase, UserCircle } from 'lucide-react'
import NotificationBell from './NotificationBell'

function Avatar({ size = 'h-8 w-8', textSize = 'text-xs', name, avatarUrl }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'

  if (avatarUrl) return <img src={avatarUrl} alt={name} className={`${size} rounded-full object-cover border-2 border-white shadow-sm`} />
  return <div className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center ${textSize} font-bold text-white shadow-sm`}>{initials}</div>
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const location = useLocation()

  const nav = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/profile', label: 'Profile', icon: UserCircle },
  ]

  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-blue-500" />
            <span className="font-semibold text-lg">Geply</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Icon className="h-4 w-4" />{label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-gray-200">
          <Link to="/profile" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
            <Avatar size="h-8 w-8" textSize="text-xs" name={user?.full_name} avatarUrl={user?.avatar_url} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button onClick={(e) => { e.preventDefault(); logout() }} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 shrink-0">
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link to="/profile"><Avatar size="h-9 w-9" textSize="text-xs" name={user?.full_name} avatarUrl={user?.avatar_url} /></Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    </div>
  )
}
