import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jobsApi, candidatesApi, reportsApi } from '../lib/api'
import { Users, Send, Calendar, FileText, Copy, Check, Clock, BarChart3, RotateCcw, X, MessageSquare, Trash2, Pencil, Upload, Search, ArrowUpDown, ArrowUp, ArrowDown, MapPin, Sun, Save, DollarSign, Plus, HelpCircle } from 'lucide-react'

const STATUS_COLORS = {
  pending:      'bg-amber-50 text-amber-700 border border-amber-200',
  invited:      'bg-blue-50 text-blue-700 border border-blue-200',
  scheduled:    'bg-violet-50 text-violet-700 border border-violet-200',
  interviewed:  'bg-cyan-50 text-cyan-700 border border-cyan-200',
  report_ready: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected:     'bg-red-50 text-red-700 border border-red-200',
  shortlisted:  'bg-teal-50 text-teal-700 border border-teal-200',
}

function ReInterviewModal({ candidate, onClose, onConfirm }) {
  const [reason, setReason]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const handleSubmit = async () => {
    if (!reason.trim()) return
    setSubmitting(true)
    try { await onConfirm(candidate.id, reason.trim()) } finally { setSubmitting(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-brand-500" /><h2 className="font-semibold text-lg">Re-interview Candidate</h2></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-1">Candidate: <span className="font-medium text-gray-700">{candidate.full_name || candidate.email}</span></p>
        {candidate.re_interview_count > 0 && <p className="text-xs text-orange-500 mb-1">Already re-interviewed {candidate.re_interview_count}x</p>}
        <p className="text-sm text-gray-400 mb-4">Previous interviews and reports are preserved.</p>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason <span className="text-red-400">*</span></label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Technical issues, need deeper assessment..." rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={!reason.trim() || submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-all">
            <RotateCcw className={`h-3.5 w-3.5 ${submitting ? 'animate-spin' : ''}`} /> {submitting ? 'Generating...' : 'Generate New Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditCandidateModal({ candidate, onClose, onSave }) {
  const [email, setEmail]       = useState(candidate.email || '')
  const [fullName, setFullName] = useState(candidate.full_name || '')
  const [phone, setPhone]       = useState(candidate.phone || '')
  const [saving, setSaving]     = useState(false)
  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = {}
      if (email.trim() !== candidate.email)              updates.email     = email.trim()
      if (fullName.trim() !== candidate.full_name)       updates.full_name = fullName.trim()
      if (phone.trim() !== (candidate.phone || ''))      updates.phone     = phone.trim()
      if (Object.keys(updates).length > 0) await onSave(candidate.id, updates)
      onClose()
    } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Pencil className="h-5 w-5 text-brand-500" /><h2 className="font-semibold text-lg">Edit Candidate</h2></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-all">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ candidate, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3"><Trash2 className="h-5 w-5 text-red-500" /><h2 className="font-semibold text-lg">Delete Candidate</h2></div>
        <p className="text-sm text-gray-500 mb-1">Delete <span className="font-medium text-gray-700">{candidate.full_name || candidate.email}</span>?</p>
        <p className="text-xs text-red-400 mb-4">Permanently removes candidate, interviews, and reports.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={async () => { setDeleting(true); try { await onConfirm(candidate.id) } finally { setDeleting(false) } }} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-all">
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
        ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-brand-500" /> : <ArrowDown className="h-3 w-3 text-brand-500" />)
        : <ArrowUpDown className="h-3 w-3 text-gray-300 group-hover:text-gray-500 transition-colors" />}
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
  const [editing, setEditing]           = useState(false)
  const [locations, setLocations]       = useState(job.office_locations || '')
  const [shiftLabel, setShiftLabel]     = useState(
    SHIFT_OPTIONS.find(o => o.shift_info === job.shift_info)?.label || 'Any shift'
  )
  const [askCtc, setAskCtc]             = useState(!!job.ask_ctc)
  const [recruiterQs, setRecruiterQs]   = useState(Array.isArray(job.recruiter_questions) ? job.recruiter_questions : [])
  const [newQuestion, setNewQuestion]   = useState('')
  const [saving, setSaving]             = useState(false)

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
  const estimatedQs  = 2 + 6 + 2 + (askCtc ? 2 : 0) + recruiterQs.length

  if (editing) {
    return (
      <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-4">
        {/* Row 1: locations + shift */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Office Locations (comma-separated)
            </label>
            <input
              type="text"
              value={locations}
              onChange={e => setLocations(e.target.value)}
              placeholder="e.g. Coimbatore, Mumbai"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Sun className="h-3 w-3" /> Shift Type
            </label>
            <select
              value={shiftLabel}
              onChange={e => setShiftLabel(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
            >
              {SHIFT_OPTIONS.map(o => (
                <option key={o.label} value={o.label}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* CTC checkbox */}
        <div className="flex items-start gap-2 p-3 bg-white border border-gray-200 rounded-lg">
          <input
            id="ask-ctc-checkbox"
            type="checkbox"
            checked={askCtc}
            onChange={e => setAskCtc(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
          />
          <label htmlFor="ask-ctc-checkbox" className="flex-1 cursor-pointer">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
              <DollarSign className="h-3.5 w-3.5 text-green-600" /> Ask candidate for CTC details
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              When enabled, the AI interviewer will ask for current and expected CTC near the end of the interview.
            </p>
          </label>
        </div>

        {/* Recruiter questions */}
        <div className="p-3 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
              <MessageSquare className="h-3.5 w-3.5 text-purple-600" /> Recruiter Custom Questions
            </div>
            <span className="text-xs text-gray-400">{recruiterQs.length} / {MAX_RECRUITER_QS}</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Questions you want the AI to ask every candidate for this role. Max {MAX_RECRUITER_QS} questions, {MAX_Q_LENGTH} chars each.
          </p>

          {recruiterQs.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {recruiterQs.map((q, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg">
                  <span className="text-xs font-semibold text-purple-600 shrink-0 mt-0.5">Q{i + 1}.</span>
                  <span className="flex-1 text-sm text-gray-700 break-words">{q}</span>
                  <button type="button" onClick={() => removeRecruiterQuestion(i)} className="text-gray-400 hover:text-red-500 shrink-0" title="Remove">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {recruiterQs.length < MAX_RECRUITER_QS && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecruiterQuestion() } }}
                placeholder="Type a question and press Enter..."
                maxLength={MAX_Q_LENGTH}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <button type="button" onClick={addRecruiterQuestion} disabled={!newQuestion.trim()}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-medium hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
          )}
        </div>

        {/* Estimated length preview */}
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
          <HelpCircle className="h-3 w-3" />
          <span>Estimated interview: <strong>~{estimatedQs} questions</strong> (2 hygiene + 6 JD + 2 resume{askCtc ? ' + 2 CTC' : ''}{recruiterQs.length > 0 ? ` + ${recruiterQs.length} custom` : ''})</span>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition-all">
            <Save className="h-3 w-3" /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={handleCancel}
            className="px-4 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {locationList.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <MapPin className="h-3.5 w-3.5 text-gray-400" />
          {locationList.map(loc => (
            <span key={loc} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{loc}</span>
          ))}
        </div>
      )}
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <Sun className="h-3 w-3" />
        {SHIFT_OPTIONS.find(o => o.shift_info === job.shift_info)?.label || 'Any shift'}
      </span>
      {job.ask_ctc && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
          <DollarSign className="h-3 w-3" /> CTC asked
        </span>
      )}
      {Array.isArray(job.recruiter_questions) && job.recruiter_questions.length > 0 && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          <MessageSquare className="h-3 w-3" /> {job.recruiter_questions.length} custom Q{job.recruiter_questions.length > 1 ? 's' : ''}
        </span>
      )}
      <button onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors ml-1">
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  )
}
export default function JobDetail() {
  const { jobId }   = useParams()
  const navigate    = useNavigate()
  const [job, setJob]                           = useState(null)
  const [jdExpanded, setJdExpanded]             = useState(false)
  const [candidates, setCandidates]             = useState([])
  const [reports, setReports]                   = useState({})
  const [copiedId, setCopiedId]                 = useState(null)
  const [loading, setLoading]                   = useState(true)
  const [reInterviewCandidate, setReInterviewCandidate] = useState(null)
  const [editCandidate, setEditCandidate]       = useState(null)
  const [deleteCandidate, setDeleteCandidate]   = useState(null)
  const [uploading, setUploading]               = useState(false)
  const [uploadMsg, setUploadMsg]               = useState('')
  const [selected, setSelected]                 = useState(new Set())
  const [inviting, setInviting]                 = useState(false)
  const [searchQuery, setSearchQuery]           = useState('')
  const [sortField, setSortField]               = useState('')
  const [sortDir, setSortDir]                   = useState('asc')
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
        const reportMap  = {}
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
      const formData   = new FormData()
      let validCount   = 0
      for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase()
        if (['pdf', 'docx', 'doc'].includes(ext)) { formData.append('files', file); validCount++ }
      }
      if (validCount === 0) { setUploadMsg('No valid files. Upload PDF or DOCX.'); return }
      const oldCount  = candidates.length
      await jobsApi.uploadResumes(jobId, formData)
      const candRes   = await candidatesApi.listByJob(jobId)
      const newCandidates = candRes.data.candidates || []
      const uploaded  = newCandidates.length - oldCount
      const skipped   = validCount - uploaded
      setCandidates(newCandidates)
      if (skipped > 0 && uploaded === 0) setUploadMsg(`⚠ All ${validCount} already exist - duplicates skipped.`)
      else if (skipped > 0) setUploadMsg(`✓ ${uploaded} uploaded, ⚠ ${skipped} duplicate(s) skipped.`)
      else setUploadMsg(`✓ ${uploaded} resume(s) uploaded!`)
      setTimeout(() => setUploadMsg(''), 5000)
      await load()
    } catch (err) { console.error(err); setUploadMsg('Upload failed.') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const pendingCandidates = candidates.filter(c => c.status === 'pending')
  const toggleSelect  = (id) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const toggleAll     = () => {
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
  const handleDelete  = async (id) => { try { await candidatesApi.delete(id); setDeleteCandidate(null); await load() } catch (e) { console.error(e) } }

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>
  if (!job) return <div className="p-6 text-red-500">Job not found</div>

  const stats = {
    total:       candidates.length,
    pending:     candidates.filter(c => c.status === 'pending').length,
    invited:     candidates.filter(c => c.status === 'invited').length,
    scheduled:   candidates.filter(c => c.status === 'scheduled').length,
    interviewed: candidates.filter(c => ['interviewed', 'report_ready'].includes(c.status)).length,
  }
  const isReInvited = (c) => ['invited', 'scheduled'].includes(c.status) && (c.re_interview_count || 0) > 0

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
        <div className="text-sm text-gray-500 mt-1">
          <p className={jdExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}>{job.jd_raw_text || job.description}</p>
          {(job.jd_raw_text || job.description || '').length > 150 && (
            <button onClick={() => setJdExpanded(!jdExpanded)} className="text-xs text-brand-600 hover:text-brand-800 mt-1 font-medium">
              {jdExpanded ? '^ Show less' : 'v Read full JD...'}
            </button>
          )}
        </div>
      </div>

      {/* ── Job Settings Banner - locations + shift ─────────────────
           Recruiter can see and edit office locations + shift requirement
           directly from the job detail page without going anywhere else.
      ─────────────────────────────────────────────────────────────── */}
      <JobSettingsBanner job={job} onSave={handleJobSettingsSave} />

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total',       value: stats.total,       icon: Users,    bg: 'bg-gray-50 border-gray-200',     color: 'text-gray-700' },
          { label: 'Pending',     value: stats.pending,     icon: Clock,    bg: 'bg-amber-50 border-amber-200',   color: 'text-amber-700' },
          { label: 'Invited',     value: stats.invited,     icon: Send,     bg: 'bg-blue-50 border-blue-200',     color: 'text-blue-700' },
          { label: 'Scheduled',   value: stats.scheduled,   icon: Calendar, bg: 'bg-violet-50 border-violet-200', color: 'text-violet-700' },
          { label: 'Interviewed', value: stats.interviewed, icon: FileText, bg: 'bg-emerald-50 border-emerald-200',color: 'text-emerald-700' },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className={`border rounded-2xl p-4 ${bg}`}>
            <div className="flex items-center gap-2 mb-1"><Icon className={`h-4 w-4 ${color}`} /><span className="text-xs font-medium text-gray-500">{label}</span></div>
            <span className={`text-2xl font-bold ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-all shadow-sm">
          <Upload className={`h-4 w-4 ${uploading ? 'animate-spin' : ''}`} /> {uploading ? 'Uploading...' : 'Upload Resumes'}
        </button>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc" className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
        {selected.size > 0 && (
          <button onClick={sendInvites} disabled={inviting}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-all shadow-sm">
            <Send className={`h-4 w-4 ${inviting ? 'animate-spin' : ''}`} />
            {inviting ? 'Sending...' : `Send Invites (${selected.size})`}
          </button>
        )}
        {uploadMsg && <span className={`text-sm font-medium ${uploadMsg.includes('failed') ? 'text-red-500' : uploadMsg.includes('duplicate') || uploadMsg.includes('already exist') ? 'text-orange-500' : 'text-green-600'}`}>{uploadMsg}</span>}
      </div>

      {/* Empty state */}
      {candidates.length === 0 && !loading && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center mb-6 hover:border-brand-400 cursor-pointer transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-brand-500', 'bg-brand-50') }}
          onDragLeave={(e) => { e.currentTarget.classList.remove('border-brand-500', 'bg-brand-50') }}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-brand-500', 'bg-brand-50'); handleFileUpload(e.dataTransfer.files) }}>
          <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Drop resumes here or click to upload</p>
          <p className="text-xs text-gray-400 mt-1">PDF and DOCX - names, emails, and phone numbers are auto-extracted</p>
        </div>
      )}

      {/* Table with Search */}
      {candidates.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search candidates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-gray-50 transition-all" />
            </div>
            <span className="text-xs text-gray-400">{filteredSorted.length} of {candidates.length} candidate(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 text-[11px] uppercase tracking-wider">
                  <th className="px-3 py-3 w-10">
                    {pendingCandidates.length > 0 && (
                      <input type="checkbox" checked={selected.size === pendingCandidates.length && pendingCandidates.length > 0} onChange={toggleAll}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                    )}
                  </th>
                  <th className="text-left px-2 py-3 font-semibold w-8">#</th>
                  <th className="text-left px-4 py-3 font-semibold"><SortHeader label="Candidate" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} /></th>
                  <th className="text-left px-4 py-3 font-semibold"><SortHeader label="Phone" field="phone" sortField={sortField} sortDir={sortDir} onSort={handleSort} /></th>
                  <th className="text-left px-4 py-3 font-semibold"><SortHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} /></th>
                  <th className="text-left px-4 py-3 font-semibold">Resume</th>
                  <th className="text-left px-4 py-3 font-semibold"><SortHeader label="Scheduled" field="scheduled" sortField={sortField} sortDir={sortDir} onSort={handleSort} /></th>
                  <th className="text-left px-4 py-3 font-semibold"><SortHeader label="Report" field="score" sortField={sortField} sortDir={sortDir} onSort={handleSort} /></th>
                  <th className="text-left px-4 py-3 font-semibold">Notes</th>
                  <th className="text-left px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSorted.map((c, idx) => {
                  const report         = reports[c.id]
                  const canReInterview = ['interviewed', 'report_ready'].includes(c.status)
                  const reInvited      = isReInvited(c)
                  const isPending      = c.status === 'pending'
                  return (
                    <tr key={c.id} className={`transition-colors ${selected.has(c.id) ? 'bg-brand-50/40' : 'hover:bg-gray-50/60'}`}>
                      <td className="px-3 py-3.5">
                        {isPending
                          ? <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="h-3.5 w-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                          : <span className="w-3.5" />}
                      </td>
                      <td className="px-2 py-3.5 text-gray-400 text-xs font-medium">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-gray-900">{c.full_name || '-'}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{c.email?.includes('@pending.geply') ? '-' : c.email}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 font-medium">{c.phone || '-'}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                        {(c.re_interview_count || 0) > 0 && (
                          <div className="flex items-center gap-1 mt-1"><RotateCcw className="h-3 w-3 text-orange-400" /><span className="text-[10px] text-orange-500 font-medium">Retry #{c.re_interview_count}</span></div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">{c.resume_parsed ? <Check className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-gray-300" />}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {c.scheduled_at ? new Date(c.scheduled_at.endsWith?.('Z') ? c.scheduled_at : c.scheduled_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        {report && c.status === 'report_ready' ? (
                          <button onClick={() => navigate(`/reports/${report.id}`)} className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors">
                            <BarChart3 className="h-3.5 w-3.5" /> {Math.round(report.overall_score)}%
                            <span className="text-gray-300">·</span>
                            <span className={['strong_yes','yes'].includes(report.verdict) ? 'text-emerald-600' : report.verdict === 'maybe' ? 'text-amber-600' : 'text-red-600'}>{report.verdict?.replace('_', ' ')}</span>
                          </button>
                        ) : report && reInvited ? (
                          <button onClick={() => navigate(`/reports/${report.id}`)} className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-orange-500 font-semibold uppercase">Previous</span>
                            <span className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"><BarChart3 className="h-3 w-3" /> {Math.round(report.overall_score)}%</span>
                          </button>
                        ) : c.status === 'interviewed' ? (
                          <span className="text-xs text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3 animate-spin" /> Generating...</span>
                        ) : <span className="text-xs text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3.5 max-w-[160px]">
                        {c.re_interview_reason
                          ? <div className="flex items-start gap-1.5"><MessageSquare className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" /><span className="text-xs text-gray-500 line-clamp-2" title={c.re_interview_reason}>{c.re_interview_reason}</span></div>
                          : <span className="text-xs text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {c.invite_token && !c.invite_token.includes('no-token') && (
                            <button onClick={() => copyInviteLink(c)} title="Copy invite link"
                              className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-all ${copiedId === c.id ? 'bg-green-100 text-green-700' : 'text-brand-600 hover:bg-brand-50'}`}>
                              {copiedId === c.id ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                            </button>
                          )}
                          <button onClick={() => setEditCandidate(c)} title="Edit" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"><Pencil className="h-3.5 w-3.5" /></button>
                          {canReInterview && <button onClick={() => setReInterviewCandidate(c)} title="Re-interview" className="p-1.5 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"><RotateCcw className="h-3.5 w-3.5" /></button>}
                          <button onClick={() => setDeleteCandidate(c)} title="Delete" className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredSorted.length === 0 && searchQuery && (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400 text-sm">No candidates match "{searchQuery}"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reInterviewCandidate && <ReInterviewModal candidate={reInterviewCandidate} onClose={() => setReInterviewCandidate(null)} onConfirm={handleReInterview} />}
      {editCandidate        && <EditCandidateModal candidate={editCandidate} onClose={() => setEditCandidate(null)} onSave={handleEditSave} />}
      {deleteCandidate      && <DeleteConfirmModal candidate={deleteCandidate} onClose={() => setDeleteCandidate(null)} onConfirm={handleDelete} />}
    </div>
  )
}
