import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jobsApi, candidatesApi, reportsApi } from '../lib/api'
import QuestionsDrawer from '../components/QuestionsDrawer'
import { Users, Send, Calendar, FileText, Copy, Check, Clock, BarChart3, RotateCcw, X, MessageSquare, Trash2, Pencil, Upload, Search, ArrowUpDown, ArrowUp, ArrowDown, MapPin, Sun, Save, DollarSign, Plus, HelpCircle } from 'lucide-react'

const STATUS_PILL = {
  pending:      'pill pill-warning',
  invited:      'pill pill-info',
  scheduled:    'pill pill-brand',
  interviewed:  'pill pill-accent',
  report_ready: 'pill pill-success',
  rejected:     'pill bg-red-500/15 text-red-300 border-red-500/30',
  shortlisted:  'pill pill-success',
}

function ReInterviewModal({ candidate, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const handleSubmit = async () => {
    if (!reason.trim()) return
    setSubmitting(true)
    try { await onConfirm(candidate.id, reason.trim()) } finally { setSubmitting(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-strong rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-brand-400" /><h2 className="font-display text-xl text-white">Re-interview Candidate</h2></div>
          <button onClick={onClose} className="text-tertiary hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-secondary mb-1">Candidate: <span className="font-medium text-white">{candidate.full_name || candidate.email}</span></p>
        {candidate.re_interview_count > 0 && <p className="text-xs text-warning mb-1">Already re-interviewed {candidate.re_interview_count}x</p>}
        <p className="text-sm text-tertiary mb-4">Previous interviews and reports are preserved.</p>
        <label className="block text-xs uppercase tracking-wider text-secondary mb-1.5">Reason <span className="text-danger">*</span></label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Technical issues, need deeper assessment..." rows={3} className="input-dark resize-none" />
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSubmit} disabled={!reason.trim() || submitting} className="btn-brand flex items-center gap-1.5 disabled:opacity-50">
            <RotateCcw className={`h-3.5 w-3.5 ${submitting ? 'animate-spin' : ''}`} /> {submitting ? 'Generating...' : 'Generate New Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditCandidateModal({ candidate, onClose, onSave }) {
  const [email, setEmail] = useState(candidate.email || '')
  const [fullName, setFullName] = useState(candidate.full_name || '')
  const [phone, setPhone] = useState(candidate.phone || '')
  const [saving, setSaving] = useState(false)
  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = {}
      if (email.trim() !== candidate.email) updates.email = email.trim()
      if (fullName.trim() !== candidate.full_name) updates.full_name = fullName.trim()
      if (phone.trim() !== (candidate.phone || '')) updates.phone = phone.trim()
      if (Object.keys(updates).length > 0) await onSave(candidate.id, updates)
      onClose()
    } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-strong rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Pencil className="h-5 w-5 text-brand-400" /><h2 className="font-display text-xl text-white">Edit Candidate</h2></div>
          <button onClick={onClose} className="text-tertiary hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="block text-xs uppercase tracking-wider text-secondary mb-1.5">Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="input-dark" /></div>
          <div><label className="block text-xs uppercase tracking-wider text-secondary mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-dark" /></div>
          <div><label className="block text-xs uppercase tracking-wider text-secondary mb-1.5">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="input-dark" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-brand disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ candidate, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-strong rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3"><Trash2 className="h-5 w-5 text-danger" /><h2 className="font-display text-xl text-white">Delete Candidate</h2></div>
        <p className="text-sm text-secondary mb-1">Delete <span className="font-medium text-white">{candidate.full_name || candidate.email}</span>?</p>
        <p className="text-xs text-danger/80 mb-5">Permanently removes candidate, interviews, and reports.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={async () => { setDeleting(true); try { await onConfirm(candidate.id) } finally { setDeleting(false) } }} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-danger text-white rounded-[10px] text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field
  return (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 group">
      <span>{label}</span>
      {active
        ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-brand-400" /> : <ArrowDown className="h-3 w-3 text-brand-400" />)
        : <ArrowUpDown className="h-3 w-3 text-tertiary group-hover:text-white transition-colors" />}
    </button>
  )
}

const SHIFT_OPTIONS = [
  { label: 'Any shift',                 shift_flexible: true,  shift_info: 'any shift' },
  { label: 'Day shift (IST)',           shift_flexible: false, shift_info: 'day shift (9 AM to 6 PM IST)' },
  { label: 'Night shift (US timezone)', shift_flexible: true,  shift_info: 'night shift supporting US timezone' },
  { label: 'Night shift (EU timezone)', shift_flexible: true,  shift_info: 'night shift supporting EU timezone' },
  { label: 'Rotational shift',          shift_flexible: true,  shift_info: 'rotational shift timings' },
]

function JobSettingsBanner({ job, onSave }) {
  const [editing, setEditing] = useState(false)
  const [locations, setLocations] = useState(job.office_locations || '')
  const [shiftLabel, setShiftLabel] = useState(
    SHIFT_OPTIONS.find(o => o.shift_info === job.shift_info)?.label || 'Any shift'
  )
  const [askCtc, setAskCtc] = useState(!!job.ask_ctc)
  const [recruiterQs, setRecruiterQs] = useState(Array.isArray(job.recruiter_questions) ? job.recruiter_questions : [])
  const [newQuestion, setNewQuestion] = useState('')
  const [saving, setSaving] = useState(false)

  const MAX_RECRUITER_QS = 5
  const MAX_Q_LENGTH = 500

  const handleSave = async () => {
    setSaving(true)
    try {
      const chosen = SHIFT_OPTIONS.find(o => o.label === shiftLabel) || SHIFT_OPTIONS[0]
      await onSave({
        office_locations:    locations.trim(),
        shift_flexible:      chosen.shift_flexible,
        shift_info:          chosen.shift_info,
        ask_ctc:             askCtc,
        recruiter_questions: recruiterQs,
      })
      setEditing(false)
    } finally { setSaving(false) }
  }

  const handleCancel = () => {
    setEditing(false)
    setLocations(job.office_locations || '')
    setShiftLabel(SHIFT_OPTIONS.find(o => o.shift_info === job.shift_info)?.label || 'Any shift')
    setAskCtc(!!job.ask_ctc)
    setRecruiterQs(Array.isArray(job.recruiter_questions) ? job.recruiter_questions : [])
    setNewQuestion('')
  }

  const addRecruiterQuestion = () => {
    const q = newQuestion.trim()
    if (!q || recruiterQs.length >= MAX_RECRUITER_QS || q.length > MAX_Q_LENGTH) return
    setRecruiterQs([...recruiterQs, q])
    setNewQuestion('')
  }

  const removeRecruiterQuestion = (idx) => {
    setRecruiterQs(recruiterQs.filter((_, i) => i !== idx))
  }

  const locationList = (locations || '').split(',').map(l => l.trim()).filter(Boolean)
  const estimatedQs = 2 + 6 + 2 + (askCtc ? 2 : 0) + recruiterQs.length

  if (editing) {
    return (
      <div className="mb-5 p-5 glass-brand rounded-2xl space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs uppercase tracking-wider text-secondary mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Office locations (comma-separated)
            </label>
            <input type="text" value={locations} onChange={e => setLocations(e.target.value)}
              placeholder="e.g. Coimbatore, Mumbai" className="input-dark" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-secondary mb-1.5 flex items-center gap-1.5">
              <Sun className="h-3 w-3" /> Shift type
            </label>
            <select value={shiftLabel} onChange={e => setShiftLabel(e.target.value)} className="input-dark">
              {SHIFT_OPTIONS.map(o => (<option key={o.label} value={o.label} className="bg-ink-200 text-white">{o.label}</option>))}
            </select>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 glass rounded-xl">
          <input id="ask-ctc-checkbox" type="checkbox" checked={askCtc} onChange={e => setAskCtc(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500" />
          <label htmlFor="ask-ctc-checkbox" className="flex-1 cursor-pointer">
            <div className="flex items-center gap-1.5 text-sm font-medium text-white">
              <DollarSign className="h-3.5 w-3.5 text-success" /> Ask candidate for CTC details
            </div>
            <p className="text-xs text-secondary mt-0.5">
              When enabled, the AI interviewer will ask for current and expected CTC near the end of the interview.
            </p>
          </label>
        </div>

        <div className="p-3 glass rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-white">
              <MessageSquare className="h-3.5 w-3.5 text-brand-400" /> Recruiter custom questions
            </div>
            <span className="text-xs text-tertiary">{recruiterQs.length} / {MAX_RECRUITER_QS}</span>
          </div>
          <p className="text-xs text-secondary mb-3">
            Questions you want the AI to ask every candidate for this role. Max {MAX_RECRUITER_QS} questions, {MAX_Q_LENGTH} chars each.
          </p>

          {recruiterQs.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {recruiterQs.map((q, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 bg-brand-500/10 border border-brand-500/20 rounded-lg">
                  <span className="text-xs font-semibold text-brand-300 shrink-0 mt-0.5">Q{i + 1}.</span>
                  <span className="flex-1 text-sm text-white break-words">{q}</span>
                  <button type="button" onClick={() => removeRecruiterQuestion(i)} className="text-tertiary hover:text-danger shrink-0" title="Remove">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {recruiterQs.length < MAX_RECRUITER_QS && (
            <div className="flex gap-2">
              <input type="text" value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecruiterQuestion() } }}
                placeholder="Type a question and press Enter..." maxLength={MAX_Q_LENGTH} className="input-dark flex-1" />
              <button type="button" onClick={addRecruiterQuestion} disabled={!newQuestion.trim()} className="btn-brand flex items-center gap-1 disabled:opacity-40">
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg text-xs text-amber-300">
          <HelpCircle className="h-3 w-3" />
          <span>Estimated interview: <strong className="text-white">~{estimatedQs} questions</strong> (2 hygiene + 6 JD + 2 resume{askCtc ? ' + 2 CTC' : ''}{recruiterQs.length > 0 ? ` + ${recruiterQs.length} custom` : ''})</span>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-brand flex items-center gap-1.5 disabled:opacity-50">
            <Save className="h-3 w-3" /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={handleCancel} className="btn-ghost">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      {locationList.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <MapPin className="h-3.5 w-3.5 text-tertiary" />
          {locationList.map(loc => (
            <span key={loc} className="pill pill-muted">{loc}</span>
          ))}
        </div>
      )}
      <span className="pill pill-warning">
        <Sun className="h-3 w-3" />
        {SHIFT_OPTIONS.find(o => o.shift_info === job.shift_info)?.label || 'Any shift'}
      </span>
      {job.ask_ctc && (
        <span className="pill pill-success">
          <DollarSign className="h-3 w-3" /> CTC asked
        </span>
      )}
      {Array.isArray(job.recruiter_questions) && job.recruiter_questions.length > 0 && (
        <span className="pill pill-brand">
          <MessageSquare className="h-3 w-3" /> {job.recruiter_questions.length} custom Q{job.recruiter_questions.length > 1 ? 's' : ''}
        </span>
      )}
      <button onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-tertiary hover:text-brand-400 transition-colors ml-1">
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  )
}export default function JobDetail() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [jdExpanded, setJdExpanded] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [reports, setReports] = useState({})
  const [copiedId, setCopiedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reInterviewCandidate, setReInterviewCandidate] = useState(null)
  const [editCandidate, setEditCandidate] = useState(null)
  const [questionsCandidate, setQuestionsCandidate] = useState(null)
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [inviting, setInviting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const fileInputRef = useRef(null)

  useEffect(() => { load() }, [jobId])

  const load = async () => {
    try {
      const [jobRes, candRes] = await Promise.all([jobsApi.get(jobId), candidatesApi.listByJob(jobId)])
      setJob(jobRes.data)
      setCandidates(candRes.data.candidates || [])
      setSelected(new Set())
      try {
        const reportsRes = await reportsApi.listByJob(jobId)
        const reportMap = {}
        for (const r of (reportsRes.data.reports || [])) if (!reportMap[r.candidate_id]) reportMap[r.candidate_id] = r
        setReports(reportMap)
      } catch {}
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleJobSettingsSave = async (updates) => {
    try {
      const { data } = await jobsApi.update(jobId, updates)
      setJob(data)
    } catch (err) { console.error(err) }
  }

  const filteredSorted = useMemo(() => {
    let result = [...candidates]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c =>
        (c.full_name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.status || '').toLowerCase().includes(q)
      )
    }
    if (sortField) {
      result.sort((a, b) => {
        let va, vb
        switch (sortField) {
          case 'name':      va = a.full_name || '';  vb = b.full_name || ''; break
          case 'status':    va = a.status || '';     vb = b.status || ''; break
          case 'phone':     va = a.phone || '';      vb = b.phone || ''; break
          case 'scheduled': va = a.scheduled_at || ''; vb = b.scheduled_at || ''; break
          case 'score':
            va = reports[a.id]?.overall_score ?? -1
            vb = reports[b.id]?.overall_score ?? -1
            break
          default: va = ''; vb = ''
        }
        if (typeof va === 'string') { const cmp = va.localeCompare(vb); return sortDir === 'asc' ? cmp : -cmp }
        return sortDir === 'asc' ? va - vb : vb - va
      })
    }
    return result
  }, [candidates, searchQuery, sortField, sortDir, reports])

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return
    setUploading(true); setUploadMsg('')
    try {
      const formData = new FormData()
      let validCount = 0
      for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase()
        if (['pdf', 'docx', 'doc'].includes(ext)) { formData.append('files', file); validCount++ }
      }
      if (validCount === 0) { setUploadMsg('No valid files. Upload PDF or DOCX.'); return }
      const oldCount = candidates.length
      await jobsApi.uploadResumes(jobId, formData)
      const candRes = await candidatesApi.listByJob(jobId)
      const newCandidates = candRes.data.candidates || []
      const uploaded = newCandidates.length - oldCount
      const skipped = validCount - uploaded
      setCandidates(newCandidates)
      if (skipped > 0 && uploaded === 0) setUploadMsg(`All ${validCount} already exist - duplicates skipped.`)
      else if (skipped > 0) setUploadMsg(`${uploaded} uploaded, ${skipped} duplicate(s) skipped.`)
      else setUploadMsg(`${uploaded} resume(s) uploaded!`)
      setTimeout(() => setUploadMsg(''), 5000)
      await load()
    } catch (err) { console.error(err); setUploadMsg('Upload failed.') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const pendingCandidates = candidates.filter(c => c.status === 'pending')
  const toggleSelect = (id) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const toggleAll = () => {
    if (selected.size === pendingCandidates.length && pendingCandidates.length > 0) setSelected(new Set())
    else setSelected(new Set(pendingCandidates.map(c => c.id)))
  }
  const sendInvites = async () => {
    if (selected.size === 0) return; setInviting(true)
    try { await candidatesApi.bulkInvite(jobId, Array.from(selected)); setSelected(new Set()); await load() }
    catch (err) { console.error(err) } finally { setInviting(false) }
  }
  const copyInviteLink = (c) => {
    navigator.clipboard.writeText(`${window.location.origin}/schedule/${c.invite_token || 'no-token'}`)
    setCopiedId(c.id); setTimeout(() => setCopiedId(null), 2000)
  }
  const handleReInterview = async (id, reason) => {
    try {
      const { data } = await candidatesApi.reInterview(id, reason)
      navigator.clipboard.writeText(`${window.location.origin}/schedule/${data.invite_token}`)
      setCopiedId(id); setTimeout(() => setCopiedId(null), 3000)
      setReInterviewCandidate(null); await load()
    } catch (e) { console.error(e) }
  }
  const handleEditSave = async (id, updates) => { try { await candidatesApi.update(id, updates); await load() } catch (e) { console.error(e) } }
  const handleDelete = async (id) => { try { await candidatesApi.delete(id); setDeleteCandidate(null); await load() } catch (e) { console.error(e) } }

  if (loading) return (
    <div className="p-8 text-tertiary flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div> Loading...
    </div>
  )
  if (!job) return <div className="p-8 text-danger">Job not found</div>

  const stats = {
    total:       candidates.length,
    pending:     candidates.filter(c => c.status === 'pending').length,
    invited:     candidates.filter(c => c.status === 'invited').length,
    scheduled:   candidates.filter(c => c.status === 'scheduled').length,
    interviewed: candidates.filter(c => ['interviewed', 'report_ready'].includes(c.status)).length,
  }
  const isReInvited = (c) => ['invited', 'scheduled'].includes(c.status) && (c.re_interview_count || 0) > 0

  const statCards = [
    { label: 'Total',       value: stats.total,       icon: Users,    dot: 'bg-white/40',    valueColor: 'text-white' },
    { label: 'Pending',     value: stats.pending,     icon: Clock,    dot: 'bg-warning',     valueColor: 'text-amber-300' },
    { label: 'Invited',     value: stats.invited,     icon: Send,     dot: 'bg-info',        valueColor: 'text-blue-300' },
    { label: 'Scheduled',   value: stats.scheduled,   icon: Calendar, dot: 'bg-brand-500',   valueColor: 'text-brand-300' },
    { label: 'Interviewed', value: stats.interviewed, icon: FileText, dot: 'bg-success',     valueColor: 'text-emerald-300' },
  ]

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-[36px] leading-tight tracking-tight text-white">
          {job.title}
        </h1>
        <div className="text-sm text-secondary mt-2 leading-relaxed">
          <p className={jdExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}>{job.jd_raw_text || job.description}</p>
          {(job.jd_raw_text || job.description || '').length > 150 && (
            <button onClick={() => setJdExpanded(!jdExpanded)} className="text-xs text-brand-400 hover:text-brand-300 mt-1.5 font-medium transition-colors">
              {jdExpanded ? 'Show less' : 'Read full JD...'}
            </button>
          )}
        </div>
      </div>

      {/* Settings banner (locations + shift + CTC + recruiter Qs) */}
      <JobSettingsBanner job={job} onSave={handleJobSettingsSave} />

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {statCards.map(({ label, value, icon: Icon, dot, valueColor }) => (
          <div key={label} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-tertiary" />
                <span className="text-xs uppercase tracking-wider text-secondary">{label}</span>
              </div>
              <div className={`w-1.5 h-1.5 rounded-full ${dot}`}></div>
            </div>
            <span className={`text-[26px] font-medium tracking-tight ${valueColor}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-ghost flex items-center gap-1.5 text-sm disabled:opacity-50">
          <Upload className={`h-4 w-4 ${uploading ? 'animate-spin' : ''}`} /> {uploading ? 'Uploading...' : 'Upload resumes'}
        </button>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc" className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
        {selected.size > 0 && (
          <button onClick={sendInvites} disabled={inviting} className="btn-brand flex items-center gap-1.5 text-sm disabled:opacity-50">
            <Send className={`h-4 w-4 ${inviting ? 'animate-spin' : ''}`} />
            {inviting ? 'Sending...' : `Send invites (${selected.size})`}
          </button>
        )}
        {uploadMsg && <span className={`text-sm font-medium ${uploadMsg.includes('failed') ? 'text-danger' : uploadMsg.includes('duplicate') || uploadMsg.includes('already exist') ? 'text-warning' : 'text-success'}`}>{uploadMsg}</span>}
      </div>

      {/* Empty state */}
      {candidates.length === 0 && !loading && (
        <div className="glass rounded-2xl p-12 text-center mb-6 border border-dashed border-white/15 hover:border-brand-400/50 cursor-pointer transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-brand-500') }}
          onDragLeave={(e) => { e.currentTarget.classList.remove('border-brand-500') }}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-brand-500'); handleFileUpload(e.dataTransfer.files) }}>
          <Upload className="h-10 w-10 text-tertiary mx-auto mb-3" />
          <p className="text-sm font-medium text-secondary">Drop resumes here or click to upload</p>
          <p className="text-xs text-tertiary mt-1">PDF and DOCX - names, emails, and phone numbers are auto-extracted</p>
        </div>
      )}

      {/* Table */}
      {candidates.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
              <input type="text" placeholder="Search candidates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="input-dark pl-9" />
            </div>
            <span className="text-xs text-tertiary">{filteredSorted.length} of {candidates.length} candidate(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.04] text-brand-200/80 text-[10.5px] uppercase tracking-[0.14em] font-semibold border-b border-white/10">
                  <th className="px-3 py-3 w-10">
                    {pendingCandidates.length > 0 && (
                      <input type="checkbox" checked={selected.size === pendingCandidates.length && pendingCandidates.length > 0} onChange={toggleAll}
                        className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500" />
                    )}
                  </th>
                  <th className="text-left px-2 py-3 font-medium w-8">#</th>
                  <th className="text-left px-4 py-3 font-medium"><SortHeader label="Candidate" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} /></th>
                  <th className="text-left px-4 py-3 font-medium"><SortHeader label="Phone" field="phone" sortField={sortField} sortDir={sortDir} onSort={handleSort} /></th>
                  <th className="text-left px-4 py-3 font-medium"><SortHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} /></th>
                  <th className="text-center px-4 py-3 font-medium" title="Resume parsing status">Resume</th>
                  <th className="text-left px-4 py-3 font-medium"><SortHeader label="Scheduled" field="scheduled" sortField={sortField} sortDir={sortDir} onSort={handleSort} /></th>
                  <th className="text-left px-4 py-3 font-medium"><SortHeader label="Report" field="score" sortField={sortField} sortDir={sortDir} onSort={handleSort} /></th>
                  <th className="text-left px-4 py-3 font-medium">Notes</th>
                  <th className="text-center px-2 py-3 font-medium whitespace-nowrap">Invite</th>
                  <th className="text-center px-2 py-3 font-medium whitespace-nowrap">Questions</th>
                  <th className="text-center px-2 py-3 font-medium whitespace-nowrap">Edit</th>
                  <th className="text-center px-2 py-3 font-medium whitespace-nowrap">Retry</th>
                  <th className="text-center px-2 py-3 font-medium whitespace-nowrap">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSorted.map((c, idx) => {
                  const report = reports[c.id]
                  const canReInterview = ['interviewed', 'report_ready'].includes(c.status)
                  const reInvited = isReInvited(c)
                  const isPending = c.status === 'pending'
                  return (
                    <tr key={c.id} className={`transition-all duration-150 ${selected.has(c.id) ? 'bg-brand-500/10 hover:bg-brand-500/15' : 'hover:bg-gradient-to-r hover:from-white/[0.02] hover:via-white/[0.04] hover:to-white/[0.02]'}`}>
                      <td className="px-3 py-3.5">
                        {isPending
                          ? <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500" />
                          : <span className="w-3.5" />}
                      </td>
                      <td className="px-2 py-3.5 text-tertiary text-xs font-medium">{idx + 1}</td>
                      <td className="px-4 py-3.5 max-w-[220px]">
                        <div className="font-medium text-white truncate" title={c.full_name || ''}>{c.full_name || '-'}</div>
                        <div className="text-xs text-tertiary mt-0.5 truncate" title={c.email || ''}>{c.email?.includes('@pending.geply') ? '-' : c.email}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-secondary font-medium">{c.phone || '-'}</td>
                      <td className="px-4 py-3.5">
                        <span className={STATUS_PILL[c.status] || 'pill pill-muted'}>{c.status}</span>
                        {(c.re_interview_count || 0) > 0 && (
                          <div className="flex items-center gap-1 mt-1"><RotateCcw className="h-3 w-3 text-warning" /><span className="text-[10px] text-warning font-medium">Retry #{c.re_interview_count}</span></div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center"><span title={c.resume_parsed ? "Resume parsed" : "Awaiting resume"} className="inline-flex">{c.resume_parsed ? <Check className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-tertiary" />}</span></td>
                      <td className="px-4 py-3.5 text-xs text-secondary">
                        {c.scheduled_at ? new Date(c.scheduled_at.endsWith?.('Z') ? c.scheduled_at : c.scheduled_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        {report && c.status === 'report_ready' ? (
                          <button onClick={() => navigate(`/reports/${report.id}`)} className="flex items-center gap-1.5 text-xs font-medium text-brand-300 hover:text-brand-200 transition-colors">
                            <BarChart3 className="h-3.5 w-3.5" /> {Math.round(report.overall_score)}%
                            <span className="text-tertiary">·</span>
                            <span className={['strong_yes','yes'].includes(report.verdict) ? 'text-success' : report.verdict === 'maybe' ? 'text-warning' : 'text-danger'}>{report.verdict?.replace('_', ' ')}</span>
                          </button>
                        ) : report && reInvited ? (
                          <button onClick={() => navigate(`/reports/${report.id}`)} className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-warning font-semibold uppercase">Previous</span>
                            <span className="flex items-center gap-1 text-xs text-tertiary hover:text-white"><BarChart3 className="h-3 w-3" /> {Math.round(report.overall_score)}%</span>
                          </button>
                        ) : c.status === 'interviewed' ? (
                          <span className="text-xs text-warning flex items-center gap-1"><Clock className="h-3 w-3 animate-spin" /> Generating...</span>
                        ) : <span className="text-xs text-tertiary">-</span>}
                      </td>
                      <td className="px-4 py-3.5 max-w-[160px]">
                        {c.re_interview_reason
                          ? <div className="flex items-start gap-1.5"><MessageSquare className="h-3 w-3 text-tertiary mt-0.5 shrink-0" /><span className="text-xs text-secondary line-clamp-2" title={c.re_interview_reason}>{c.re_interview_reason}</span></div>
                          : <span className="text-xs text-tertiary">-</span>}
                      </td>
                      <td className="px-2 py-3.5 text-center">
                        {c.invite_token && !c.invite_token.includes('no-token') ? (
                          <button onClick={() => copyInviteLink(c)} title="Copy invite link"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${copiedId === c.id ? 'bg-success/15 text-success' : 'text-brand-300 hover:bg-brand-500/10'}`}>
                            {copiedId === c.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        ) : <span className="text-tertiary text-xs">-</span>}
                      </td>
                      <td className="px-2 py-3.5 text-center">
                        {c.resume_parsed ? (
                          <button onClick={() => setQuestionsCandidate(c)} title="View interview questions" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-brand-300 hover:text-brand-200 hover:bg-brand-500/10 transition-all">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        ) : <span className="text-tertiary text-xs">-</span>}
                      </td>
                      <td className="px-2 py-3.5 text-center">
                        <button onClick={() => setEditCandidate(c)} title="Edit candidate" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-tertiary hover:text-white hover:bg-white/5 transition-all">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                      <td className="px-2 py-3.5 text-center">
                        {canReInterview ? (
                          <button onClick={() => setReInterviewCandidate(c)} title="Re-interview candidate" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-warning hover:bg-warning/10 transition-all">
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        ) : <span className="text-tertiary text-xs">-</span>}
                      </td>
                      <td className="px-2 py-3.5 text-center">
                        <button onClick={() => setDeleteCandidate(c)} title="Delete candidate" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-tertiary hover:text-danger hover:bg-danger/10 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredSorted.length === 0 && searchQuery && (
                  <tr><td colSpan={14} className="text-center py-8 text-tertiary text-sm">No candidates match "{searchQuery}"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reInterviewCandidate && <ReInterviewModal candidate={reInterviewCandidate} onClose={() => setReInterviewCandidate(null)} onConfirm={handleReInterview} />}
      {editCandidate && <EditCandidateModal candidate={editCandidate} onClose={() => setEditCandidate(null)} onSave={handleEditSave} />}
      {deleteCandidate && <DeleteConfirmModal candidate={deleteCandidate} onClose={() => setDeleteCandidate(null)} onConfirm={handleDelete} />}
      {questionsCandidate && <QuestionsDrawer candidateId={questionsCandidate.id} candidateName={questionsCandidate.full_name || questionsCandidate.email} onClose={() => setQuestionsCandidate(null)} />}
    </div>
  )
}