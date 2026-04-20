import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { jobsApi } from '../lib/api'
import { Plus, Upload, ChevronRight, Users, FileText, Pencil, Trash2, X, Pause, Play, Search } from 'lucide-react'

// ── Edit Job Modal ──
function EditJobModal({ job, onClose, onSave }) {
  const [title, setTitle] = useState(job.title || '')
  const [description, setDescription] = useState(job.description || '')
  const [requirements, setRequirements] = useState(job.requirements || '')
  const [duration, setDuration] = useState(job.interview_duration_minutes || 30)
  const [maxQ, setMaxQ] = useState(job.max_questions || 10)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = {}
      if (title.trim() !== job.title) updates.title = title.trim()
      if (description.trim() !== job.description) updates.description = description.trim()
      if (requirements.trim() !== (job.requirements || '')) updates.requirements = requirements.trim()
      if (duration !== job.interview_duration_minutes) updates.interview_duration_minutes = duration
      if (maxQ !== job.max_questions) updates.max_questions = maxQ
      if (Object.keys(updates).length > 0) await onSave(job.id, updates)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-strong rounded-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-brand-400" />
            <h2 className="font-display text-xl text-white">Edit Job</h2>
          </div>
          <button onClick={onClose} className="text-tertiary hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-secondary mb-1.5 uppercase tracking-wider">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input-dark" />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1.5 uppercase tracking-wider">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="input-dark resize-none" />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1.5 uppercase tracking-wider">Requirements</label>
            <textarea value={requirements} onChange={e => setRequirements(e.target.value)} rows={2} className="input-dark resize-none" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-secondary mb-1.5 uppercase tracking-wider">Duration (min)</label>
              <input type="number" value={duration} min={10} max={60} onChange={e => setDuration(+e.target.value)} className="input-dark" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-secondary mb-1.5 uppercase tracking-wider">Max Questions</label>
              <input type="number" value={maxQ} min={3} max={25} onChange={e => setMaxQ(+e.target.value)} className="input-dark" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Job Modal ──
function DeleteJobModal({ job, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-strong rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="h-5 w-5 text-danger" />
          <h2 className="font-display text-xl text-white">Delete Job</h2>
        </div>
        <p className="text-sm text-secondary mb-1">Delete <span className="font-medium text-white">{job.title}</span>?</p>
        <p className="text-xs text-danger/80 mb-5">This permanently removes the job, all candidates, interviews, and reports.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={async () => { setDeleting(true); try { await onConfirm(job.id) } finally { setDeleting(false) } }} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-danger text-white rounded-[10px] text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ──
export default function Dashboard() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedJobId, setExpandedJobId] = useState(null)
  const [editJob, setEditJob] = useState(null)
  const [deleteJob, setDeleteJob] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { loadJobs() }, [])

  const loadJobs = async () => {
    try {
      const { data } = await jobsApi.list()
      setJobs(data.jobs || [])
    } catch (err) { console.error('Failed to load jobs', err) }
    finally { setLoading(false) }
  }

  const handleEditSave = async (jobId, updates) => {
    try { await jobsApi.update(jobId, updates); await loadJobs() }
    catch (err) { console.error(err) }
  }

  const handleDelete = async (jobId) => {
    try { await jobsApi.delete(jobId); setDeleteJob(null); await loadJobs() }
    catch (err) { console.error(err) }
  }

  const handleToggleStatus = async (e, job) => {
    e.stopPropagation()
    const newStatus = job.status === 'active' ? 'paused' : 'active'
    try { await jobsApi.update(job.id, { status: newStatus }); await loadJobs() }
    catch (err) { console.error(err) }
  }

  const filteredJobs = jobs.filter(j =>
    !searchQuery ||
    j.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    j.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-8 max-w-6xl">
      {/* ── Hero heading ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs text-brand-400 uppercase tracking-[0.15em] font-medium mb-2">Command Center</p>
          <h1 className="font-display text-[40px] leading-tight tracking-tight text-white">
            Your <span className="text-gradient">jobs</span>
          </h1>
          <p className="text-sm text-secondary mt-2">Upload JDs, manage candidates, generate AI interview invites</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-brand flex items-center gap-1.5 text-sm">
          <Plus className="h-4 w-4" /> New Job
        </button>
      </div>

      {/* Search */}
      {!showCreate && jobs.length > 0 && (
        <div className="mb-5 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
          <input type="text" placeholder="Search jobs by title..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-dark pl-10" />
        </div>
      )}

      {showCreate && <CreateJobForm onDone={() => { setShowCreate(false); loadJobs() }} onCancel={() => setShowCreate(false)} />}

      {loading ? (
        <div className="text-center py-16 text-tertiary">
          <div className="inline-block w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-3"></div>
          <p className="text-sm">Loading jobs...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="glass rounded-2xl text-center py-16">
          <FileText className="h-12 w-12 mx-auto mb-3 text-tertiary opacity-50" />
          <p className="text-secondary">{searchQuery ? 'No jobs match your search.' : 'No jobs yet. Create one to get started.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <div key={job.id}
              className="glass hover:border-brand-500/30 rounded-2xl transition-all duration-200 group">
              <div className="flex items-start gap-4 p-5">
                {/* Clickable job area */}
                <div className="flex-1 min-w-0">
                  <button onClick={() => navigate(`/jobs/${job.id}`)} className="text-left">
                    <h3 className="font-medium text-[15px] text-white truncate group-hover:text-brand-300 transition-colors">{job.title}</h3>
                  </button>
                  <div className={`text-sm text-secondary mt-1 leading-relaxed ${expandedJobId === job.id ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                    {job.jd_raw_text || job.description}
                  </div>
                  {(job.jd_raw_text || job.description || '').length > 100 && (
                    <button onClick={(e) => { e.stopPropagation(); setExpandedJobId(expandedJobId === job.id ? null : job.id) }}
                      className="text-xs text-brand-400 hover:text-brand-300 mt-1.5 transition-colors">
                      {expandedJobId === job.id ? 'Show less' : 'Read full JD...'}
                    </button>
                  )}
                </div>

                {/* Stats + Actions */}
                <div className="flex items-center gap-2 text-sm shrink-0">
                  <span className="flex items-center gap-1 text-secondary px-2 py-1">
                    <Users className="h-3.5 w-3.5" /> {job.candidate_count || 0}
                  </span>

                  {/* Status toggle */}
                  <button onClick={(e) => handleToggleStatus(e, job)}
                    className={`pill ${job.status === 'active' ? 'pill-success' : job.status === 'paused' ? 'pill-warning' : 'pill-muted'} hover:brightness-125 transition-all`}>
                    {job.status === 'active' ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    {job.status}
                  </button>

                  {/* Edit */}
                  <button onClick={(e) => { e.stopPropagation(); setEditJob(job) }}
                    className="p-1.5 text-tertiary hover:text-white hover:bg-white/5 rounded-md transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {/* Delete */}
                  <button onClick={(e) => { e.stopPropagation(); setDeleteJob(job) }}
                    className="p-1.5 text-tertiary hover:text-danger hover:bg-danger/10 rounded-md transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <button onClick={() => navigate(`/jobs/${job.id}`)}
                    className="p-1.5 text-tertiary hover:text-white transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {editJob && <EditJobModal job={editJob} onClose={() => setEditJob(null)} onSave={handleEditSave} />}
      {deleteJob && <DeleteJobModal job={deleteJob} onClose={() => setDeleteJob(null)} onConfirm={handleDelete} />}
    </div>
  )
}

function CreateJobForm({ onDone, onCancel }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [duration, setDuration] = useState(30)
  const [maxQuestions, setMaxQuestions] = useState(10)
  const [jdFile, setJdFile] = useState(null)
  const [resumes, setResumes] = useState([])
  const [emails, setEmails] = useState('')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [createdJobId, setCreatedJobId] = useState(null)
  const [status, setStatus] = useState('')
  const resumeRef = useRef()

  const handleCreateJob = async () => {
    setLoading(true)
    setStatus('Creating job...')
    try {
      const fd = new FormData()
      fd.append('title', title)
      fd.append('description', description)
      fd.append('requirements', requirements)
      fd.append('interview_duration_minutes', duration)
      fd.append('max_questions', maxQuestions)
      if (jdFile) fd.append('jd_file', jdFile)

      const { data } = await jobsApi.create(fd)
      setCreatedJobId(data.id)
      setStep(2)
      setStatus('Job created. Upload resumes now (or skip).')
    } catch (err) {
      setStatus(`Error: ${err.response?.data?.error?.message || err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadResumes = async () => {
    if (!createdJobId || resumes.length === 0) return
    setLoading(true)
    setStatus(`Uploading ${resumes.length} resumes...`)
    try {
      const fd = new FormData()
      for (const f of resumes) fd.append('files', f)
      if (emails) fd.append('emails', emails)

      const { data } = await jobsApi.uploadResumes(createdJobId, fd)
      setStatus(`Uploaded ${data.uploaded} resumes.`)
      setTimeout(onDone, 1500)
    } catch (err) {
      setStatus(`Error: ${err.response?.data?.error?.message || err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-medium text-white">{step}</div>
        <h2 className="font-display text-xl text-white">{step === 1 ? 'Job details' : 'Upload resumes'}</h2>
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <input type="text" placeholder="Job title (e.g. Senior Backend Engineer)" value={title}
            onChange={(e) => setTitle(e.target.value)} required className="input-dark" />
          <textarea placeholder="Job description" value={description} rows={3}
            onChange={(e) => setDescription(e.target.value)} className="input-dark resize-none" />
          <textarea placeholder="Requirements (skills, experience, etc.)" value={requirements} rows={2}
            onChange={(e) => setRequirements(e.target.value)} className="input-dark resize-none" />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-secondary uppercase tracking-wider">Duration (min)</label>
              <input type="number" value={duration} min={10} max={60} onChange={(e) => setDuration(+e.target.value)} className="input-dark mt-1" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-secondary uppercase tracking-wider">Max questions</label>
              <input type="number" value={maxQuestions} min={3} max={25} onChange={(e) => setMaxQuestions(+e.target.value)} className="input-dark mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-secondary uppercase tracking-wider">JD file (optional PDF/DOCX)</label>
            <input type="file" accept=".pdf,.docx,.doc" onChange={(e) => setJdFile(e.target.files[0])}
              className="mt-1 w-full text-sm text-secondary file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-brand-500/20 file:text-brand-300 file:cursor-pointer hover:file:bg-brand-500/30" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-secondary uppercase tracking-wider mb-1 block">Upload resumes (PDF/DOCX)</label>
            <input ref={resumeRef} type="file" multiple accept=".pdf,.docx,.doc"
              onChange={(e) => setResumes(Array.from(e.target.files))}
              className="w-full text-sm text-secondary file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-brand-500/20 file:text-brand-300 file:cursor-pointer hover:file:bg-brand-500/30" />
            {resumes.length > 0 && <p className="text-xs text-brand-400 mt-1">{resumes.length} file(s) selected</p>}
          </div>
          <div>
            <label className="text-xs text-secondary uppercase tracking-wider">Candidate emails (comma-separated, optional)</label>
            <textarea placeholder="john@email.com, jane@email.com, ..." value={emails}
              onChange={(e) => setEmails(e.target.value)} rows={2} className="input-dark mt-1 resize-none" />
          </div>
        </div>
      )}

      {status && <p className="text-sm text-brand-300 mt-3">{status}</p>}

      <div className="flex gap-2 mt-5">
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
        {step === 1 ? (
          <button onClick={handleCreateJob} disabled={loading || !title} className="btn-brand disabled:opacity-50 flex items-center gap-1.5">
            {loading ? 'Creating...' : <>Next <ChevronRight className="h-3.5 w-3.5" /></>}
          </button>
        ) : (
          <>
            <button onClick={onDone} className="btn-ghost">Skip - add later</button>
            <button onClick={handleUploadResumes} disabled={loading || resumes.length === 0}
              className="btn-brand disabled:opacity-50 flex items-center gap-1.5">
              {loading ? 'Processing...' : <><Upload className="h-3.5 w-3.5" /> Upload resumes</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}