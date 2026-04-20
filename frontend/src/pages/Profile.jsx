import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../hooks/useAuth'
import { authApi, settingsApi } from '../lib/api'
import api from '../lib/api'
import {
  User, Building, Mail, Check, Camera, Briefcase,
  Users, MessageSquare, Pencil, X, BookOpen
} from 'lucide-react'

export default function Profile() {
  const { user, loadUser } = useAuthStore()

  // Personal info
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)

  // KB (platform-wide, admin-only edit)
  const [companyKb, setCompanyKb] = useState('')
  const [editingKb, setEditingKb] = useState(false)
  const [savingKb, setSavingKb] = useState(false)
  const [savedKb, setSavedKb] = useState(false)
  const [kbDraft, setKbDraft] = useState('')

  // Avatar + stats
  const [uploading, setUploading] = useState(false)
  const [stats, setStats] = useState({ active_jobs: 0, interviews_done: 0, total_candidates: 0 })
  const fileRef = useRef()

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '')
      setCompany(user.company || '')
    }
    loadStats()
    loadKb()
  }, [user])

  // ── Load stats (uses shared API client with correct token) ──
  const loadStats = async () => {
    try {
      const { data } = await authApi.stats()
      setStats(data)
    } catch (err) { console.error('[stats]', err) }
  }

  // ── Load KB from platform-wide app_settings ──
  const loadKb = async () => {
    try {
      const { data } = await settingsApi.getKb()
      setCompanyKb(data.company_kb || '')
    } catch (err) { console.error('[KB load]', err) }
  }

  // ── Profile save (name + company only) ──
  const handleProfileSave = async () => {
    setSavingProfile(true); setSavedProfile(false)
    try {
      await authApi.updateProfile({ full_name: fullName, company })
      await loadUser()
      setSavedProfile(true); setEditingProfile(false)
      setTimeout(() => setSavedProfile(false), 3000)
    } catch (err) { console.error(err) }
    finally { setSavingProfile(false) }
  }

  const handleProfileCancel = () => {
    setFullName(user?.full_name || '')
    setCompany(user?.company || '')
    setEditingProfile(false)
  }

  // ── KB save (admin only) ──
  const handleKbEdit = () => {
    setKbDraft(companyKb)
    setEditingKb(true)
  }

  const handleKbSave = async () => {
    setSavingKb(true); setSavedKb(false)
    try {
      await settingsApi.updateKb(kbDraft)
      setCompanyKb(kbDraft)
      setSavedKb(true); setEditingKb(false)
      setTimeout(() => setSavedKb(false), 3000)
    } catch (err) { console.error(err) }
    finally { setSavingKb(false) }
  }

  const handleKbCancel = () => {
    setKbDraft('')
    setEditingKb(false)
  }

  // ── Avatar upload (uses shared API client, refreshes user from /me) ──
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post('/auth/profile/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      // Refresh user from API — avatar_url comes from /auth/me
      await loadUser()
    } catch (err) { console.error(err) }
    finally { setUploading(false) }
  }

  const avatarUrl = user?.avatar_url || ''
  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">Profile Settings</h1>

      {/* ── Avatar ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {avatarUrl
              ? <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-full object-cover border-2 border-gray-200" />
              : <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{initials}</span>
                </div>}
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
              {uploading
                ? <div className="h-3.5 w-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                : <Camera className="h-3.5 w-3.5 text-gray-600" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">{user?.full_name || 'User'}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.is_admin ? 'Administrator' : 'Recruiter'}</p>
          </div>
        </div>
      </div>

      {/* ── Personal Information ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Personal Information</h3>
          {!editingProfile && (
            <button onClick={() => setEditingProfile(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
              <User className="h-3.5 w-3.5" /> Full Name
            </label>
            {editingProfile
              ? <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              : <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-800">{user?.full_name || '\u2014'}</p>}
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
              <Building className="h-3.5 w-3.5" /> Company
            </label>
            {editingProfile
              ? <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              : <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-800">{user?.company || '\u2014'}</p>}
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </label>
            <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-500">{user?.email || '\u2014'}</p>
          </div>
          {editingProfile && (
            <div className="flex gap-2 pt-2">
              <button onClick={handleProfileSave} disabled={savingProfile}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {savingProfile ? 'Saving...' : <><Check className="h-4 w-4" /> Save Changes</>}
              </button>
              <button onClick={handleProfileCancel}
                className="flex items-center gap-1.5 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          )}
          {savedProfile && !editingProfile && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <Check className="h-4 w-4" /> Profile updated successfully
            </p>
          )}
        </div>
      </div>

      {/* ── Company Knowledge Base ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold">Company Knowledge Base</h3>
          </div>
          {!editingKb && user?.is_admin && (
            <button onClick={handleKbEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3 ml-6">
          The AI uses this to answer candidates' questions about your company during interviews.
          Shared across all recruiters on this platform.
        </p>

        {editingKb ? (
          <>
            <textarea
              value={kbDraft}
              onChange={e => setKbDraft(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={handleKbSave} disabled={savingKb}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {savingKb ? 'Saving...' : <><Check className="h-4 w-4" /> Save KB</>}
              </button>
              <button onClick={handleKbCancel}
                className="flex items-center gap-1.5 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap min-h-[60px] max-h-48 overflow-y-auto font-mono">
            {companyKb || <span className="text-gray-400 italic font-sans">No company information added yet. Click Edit to add it.</span>}
          </div>
        )}

        {savedKb && !editingKb && (
          <p className="text-sm text-green-600 flex items-center gap-1 mt-2">
            <Check className="h-4 w-4" /> Knowledge base updated successfully
          </p>
        )}
      </div>

      {/* ── Stats (scoped to current user via /auth/stats) ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold mb-4">Account Overview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <Briefcase className="h-5 w-5 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-semibold text-blue-600">{stats.active_jobs}</p>
            <p className="text-xs text-gray-500 mt-1">Active Jobs</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <MessageSquare className="h-5 w-5 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-semibold text-green-600">{stats.interviews_done}</p>
            <p className="text-xs text-gray-500 mt-1">Interviews Done</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <Users className="h-5 w-5 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-semibold text-purple-600">{stats.total_candidates}</p>
            <p className="text-xs text-gray-500 mt-1">Candidates</p>
          </div>
        </div>
      </div>
    </div>
  )
}
