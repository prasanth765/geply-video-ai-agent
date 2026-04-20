import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../lib/api'
import { Bell, CheckCheck, FileText, Calendar, RotateCcw, Users, X, Trash2 } from 'lucide-react'

const TYPE_CONFIG = {
  report_ready: { icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-100', accent: 'border-l-emerald-500', label: 'Report' },
  interview_completed: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100', accent: 'border-l-blue-500', label: 'Interview' },
  candidate_scheduled: { icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-100', accent: 'border-l-purple-500', label: 'Schedule' },
  re_interview_requested: { icon: RotateCcw, color: 'text-orange-600', bg: 'bg-orange-100', accent: 'border-l-orange-500', label: 'Re-interview' },
  job_created: { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100', accent: 'border-l-indigo-500', label: 'Job' },
  interview_started: { icon: Calendar, color: 'text-teal-600', bg: 'bg-teal-100', accent: 'border-l-teal-500', label: 'Live' },
  candidate_uploaded: { icon: Users, color: 'text-gray-600', bg: 'bg-gray-100', accent: 'border-l-gray-400', label: 'Upload' },
  invite_sent: { icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', accent: 'border-l-blue-500', label: 'Invite' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  // Server stores UTC — append Z if no timezone info so JS parses as UTC
  let d = String(dateStr)
  if (!d.endsWith('Z') && !d.includes('+')) d += 'Z'
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('all') // all | unread
  const [limit, setLimit] = useState(10)
  const [hasMore, setHasMore] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  // Poll unread count
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 10000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchUnreadCount = async () => {
    try { const { data } = await notificationsApi.unreadCount(); setUnreadCount(data.unread_count || 0) } catch {}
  }

  const loadNotifications = useCallback(async (unreadOnly = false, loadLimit = 10) => {
    setLoading(true)
    try {
      const { data } = await notificationsApi.list(unreadOnly, loadLimit + 1) // fetch 1 extra to check hasMore
      const items = data.notifications || []
      setHasMore(items.length > loadLimit)
      setNotifications(items.slice(0, loadLimit))
      setUnreadCount(data.unread_count || 0)
    } catch {} finally { setLoading(false) }
  }, [])

  const handleOpen = () => {
    if (!open) { setTab('all'); setLimit(10); loadNotifications(false, 10) }
    setOpen(!open)
  }

  const handleTabChange = (newTab) => {
    setTab(newTab)
    setLimit(10)
    loadNotifications(newTab === 'unread', 10)
  }

  const handleViewMore = () => {
    const newLimit = limit + 10
    setLimit(newLimit)
    loadNotifications(tab === 'unread', newLimit)
  }

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {}
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {}
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try {
      await notificationsApi.remove(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      fetchUnreadCount()
    } catch {}
  }

  const handleClick = (notif) => {
    if (!notif.is_read) handleMarkRead(notif.id)
    const meta = typeof notif.metadata === 'string' ? (() => { try { return JSON.parse(notif.metadata) } catch { return {} } })() : (notif.metadata || {})
    if (meta.report_id) navigate(`/reports/${meta.report_id}`)
    else if (meta.job_id) navigate(`/jobs/${meta.job_id}`)
    setOpen(false)
  }

  // Filtered list
  const filtered = tab === 'unread' ? notifications.filter(n => !n.is_read) : notifications

  return (
    <div ref={ref} className="relative">
      {/* Bell */}
      <button onClick={handleOpen} className="relative p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-[18px] min-w-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed right-4 top-4 w-[400px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 40px)' }}>

            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-900">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead}
                      className="text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors">
                      Mark All Read
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'unread', label: 'Unread', count: unreadCount },
                ].map(t => (
                  <button key={t.key} onClick={() => handleTabChange(t.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      tab === t.key
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {t.label}
                    {t.count > 0 && <span className="ml-1 opacity-75">({t.count})</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
              {loading && filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="animate-spin h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">{tab === 'unread' ? 'All caught up!' : 'No notifications yet'}</p>
                  <p className="text-xs text-gray-300 mt-1">Updates appear here when candidates take action</p>
                </div>
              ) : (
                <div>
                  {filtered.map(n => {
                    const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.candidate_uploaded
                    const Icon = config.icon
                    const meta = typeof n.metadata === 'string' ? (() => { try { return JSON.parse(n.metadata) } catch { return {} } })() : (n.metadata || {})
                    const candidateName = meta.candidate_name || ''

                    return (
                      <button key={n.id} onClick={() => handleClick(n)}
                        className={`w-full flex items-start gap-3 px-5 py-3.5 text-left transition-all hover:bg-gray-50 border-b border-gray-50 border-l-[3px] ${
                          !n.is_read ? `${config.accent} bg-blue-50/30` : 'border-l-transparent'
                        }`}>
                        <div className={`mt-0.5 h-9 w-9 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[13px] leading-snug ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                              {n.title}
                            </p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-gray-400">{timeAgo(n.created_at)}</span>
                              {!n.is_read && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                              <button onClick={(e) => handleDelete(e, n.id)} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                          {/* Action hint */}
                          <div className="mt-1.5">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                              {meta.report_id ? 'View Report →' : meta.job_id ? 'View Job →' : config.label}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}

                  {/* View More */}
                  {hasMore && (
                    <button onClick={handleViewMore}
                      className="w-full py-3 text-center text-xs font-medium text-brand-600 hover:text-brand-800 hover:bg-gray-50 transition-colors border-t border-gray-100">
                      View More
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
