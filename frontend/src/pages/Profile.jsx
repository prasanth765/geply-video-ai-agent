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

  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)

  const [companyKb, setCompanyKb] = useState('')
  const [editingKb, setEditingKb] = useState(false)
  const [savingKb, setSavingKb] = useState(false)
  const [savedKb, setSavedKb] = useState(false)
  const [kbDraft, setKbDraft] = useState('')

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

  const loadStats = async () => {
    try {
      const { data } = await authApi.stats()
      setStats(data)
    } catch (err) { console.error('[stats]', err) }
  }

  const loadKb = async () => {
    try {
      const { data } = await settingsApi.getKb()
      setCompanyKb(data.company_kb || '')
    } catch (err) { console.error('[KB load]', err) }
  }

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
      await loadUser()
    } catch (err) { console.error(err) }
    finally { setUploading(false) }
  }

  const avatarUrl = user?.avatar_url || ''
  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="p-8 max-w-3xl">
      {/* Hero */}
      <div className="mb-6">
        <p className="text-xs text-brand-400 uppercase tracking-[0.15em] font-medium mb-2">Account</p>
        <h1 className="font-display text-[36px] leading-tight tracking-tight text-white">
          Your <span className="text-gradient">profile</span>
        </h1>
      </div>

      {/* Avatar card */}
      <div className="glass rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {avatarUrl
              ? <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-full object-cover border-2 border-white/10 shadow-glass" />
              : <div className="h-20 w-20 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-glow-brand">
                  <span className="text-2xl font-medium text-white">{initials}</span>
                </div>}
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
              {uploading
                ? <div className="h-3.5 w-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                : <Camera className="h-3.5 w-3.5 text-white" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-white tracking-tight">{user?.full_name || 'User'}</h2>
            <p className="text-sm text-secondary mt-0.5">{user?.email}</p>
            <span className={`inline-flex mt-1.5 ${user?.is_admin ? 'pill pill-brand' : 'pill pill-muted'}`}>
              {user?.is_admin ? 'Administrator' : 'Recruiter'}
            </span>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="glass rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-white">Personal information</h3>
          {!editingProfile && (
            <button onClick={() => setEditingProfile(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-300 hover:bg-brand-500/10 rounded-lg transition-colors">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-secondary mb-1.5">
              <User className="h-3.5 w-3.5" /> Full name
            </label>
            {editingProfile
              ? <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="input-dark" />
              : <p className="px-3 py-2.5 bg-white/[0.03] border border-white/5 rounded-[10px] text-sm text-white">{user?.full_name || '\u2014'}</p>}
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-secondary mb-1.5">
              <Building className="h-3.5 w-3.5" /> Company
            </label>
            {editingProfile
              ? <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="input-dark" />
              : <p className="px-3 py-2.5 bg-white/[0.03] border border-white/5 rounded-[10px] text-sm text-white">{user?.company || '\u2014'}</p>}
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-secondary mb-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </label>
            <p className="px-3 py-2.5 bg-white/[0.03] border border-white/5 rounded-[10px] text-sm text-tertiary">{user?.email || '\u2014'}</p>
          </div>
          {editingProfile && (
            <div className="flex gap-2 pt-1">
              <button onClick={handleProfileSave} disabled={savingProfile} className="btn-brand flex items-center gap-1.5 disabled:opacity-50">
                {savingProfile ? 'Saving...' : <><Check className="h-4 w-4" /> Save changes</>}
              </button>
              <button onClick={handleProfileCancel} className="btn-ghost flex items-center gap-1.5">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          )}
          {savedProfile && !editingProfile && (
            <p className="text-sm text-success flex items-center gap-1">
              <Check className="h-4 w-4" /> Profile updated successfully
            </p>
          )}
        </div>
      </div>

      {/* Company Knowledge Base */}
      <div className="glass rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand-400" />
            <h3 className="font-display text-xl text-white">Company knowledge base</h3>
          </div>
          {!editingKb && user?.is_admin && (
            <button onClick={handleKbEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-300 hover:bg-brand-500/10 rounded-lg transition-colors">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>
        <p className="text-xs text-secondary mb-3 ml-6">
          The AI uses this to answer candidates' questions about your company during interviews.
          Shared across all recruiters on this platform.
        </p>

        {editingKb ? (
          <>
            <textarea
              value={kbDraft}
              onChange={e => setKbDraft(e.target.value)}
              rows={10}
              className="input-dark resize-y font-mono text-xs"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={handleKbSave} disabled={savingKb} className="btn-brand flex items-center gap-1.5 disabled:opacity-50">
                {savingKb ? 'Saving...' : <><Check className="h-4 w-4" /> Save KB</>}
              </button>
              <button onClick={handleKbCancel} className="btn-ghost flex items-center gap-1.5">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="px-3 py-2.5 bg-white/[0.03] border border-white/5 rounded-[10px] text-xs text-secondary whitespace-pre-wrap min-h-[60px] max-h-48 overflow-y-auto font-mono">
            {companyKb || <span className="text-tertiary italic font-sans">No company information added yet. Click Edit to add it.</span>}
          </div>
        )}

        {savedKb && !editingKb && (
          <p className="text-sm text-success flex items-center gap-1 mt-2">
            <Check className="h-4 w-4" /> Knowledge base updated successfully
          </p>
        )}
      </div>

      {/* Account Overview — stats */}
      <div className="glass rounded-2xl p-6">
        <h3 className="font-display text-xl text-white mb-4">Account overview</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-xl p-4 text-center">
            <Briefcase className="h-5 w-5 text-brand-400 mx-auto mb-2" />
            <p className="text-[26px] font-medium text-white tracking-tight">{stats.active_jobs}</p>
            <p className="text-xs text-secondary mt-1 uppercase tracking-wider">Active jobs</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <MessageSquare className="h-5 w-5 text-success mx-auto mb-2" />
            <p className="text-[26px] font-medium text-white tracking-tight">{stats.interviews_done}</p>
            <p className="text-xs text-secondary mt-1 uppercase tracking-wider">Interviews done</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <Users className="h-5 w-5 text-accent-500 mx-auto mb-2" />
            <p className="text-[26px] font-medium text-white tracking-tight">{stats.total_candidates}</p>
            <p className="text-xs text-secondary mt-1 uppercase tracking-wider">Candidates</p>
          </div>
        </div>
      </div>
    </div>
  )
}