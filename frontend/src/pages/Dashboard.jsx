import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { jobsApi } from '../lib/api'
import { Plus, Upload, ChevronRight, Users, FileText, Pencil, Trash2, X, Pause, Play } from 'lucide-react'

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Pencil className="h-5 w-5 text-brand-500" /><h2 className="font-semibold text-lg">Edit Job</h2></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requirements</label>
            <textarea value={requirements} onChange={e => setRequirements(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500 resize-none" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Duration (min)</label>
              <input type="number" value={duration} min={10} max={60} onChange={e => setDuration(+e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Max Questions</label>
              <input type="number" value={maxQ} min={3} max={25} onChange={e => setMaxQ(+e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3"><Trash2 className="h-5 w-5 text-red-500" /><h2 className="font-semibold text-lg">Delete Job</h2></div>
        <p className="text-sm text-gray-500 mb-1">Delete <span className="font-medium text-gray-700">{job.title}</span>?</p>
        <p className="text-xs text-red-400 mb-4">This permanently removes the job, all candidates, interviews, and reports.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button onClick={async () => { setDeleting(true); try { await onConfirm(job.id) } finally { setDeleting(false) } }} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
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

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Jobs</h1>
          <p className="text-sm text-gray-500">Upload JD + resumes, generate interview invites</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
          <Plus className="h-4 w-4" /> New Job
        </button>
      </div>

      {/* Search */}
      {!showCreate && jobs.length > 0 && (
        <div className="mb-4">
          <input type="text" placeholder="Search jobs by title..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
        </div>
      )}

      {showCreate && <CreateJobForm onDone={() => { setShowCreate(false); loadJobs() }} onCancel={() => setShowCreate(false)} />}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No jobs yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.filter(j => !searchQuery || j.title?.toLowerCase().includes(searchQuery.toLowerCase()) || j.description?.toLowerCase().includes(searchQuery.toLowerCase())).map((job) => (
            <div key={job.id}
              className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-brand-300 transition-colors">
              {/* Clickable job area */}
              <div className="flex-1 min-w-0">
                <button onClick={() => navigate(`/jobs/${job.id}`)} className="text-left">
                  <h3 className="font-medium truncate hover:text-brand-600">{job.title}</h3>
                </button>
                <div className={`text-sm text-gray-500 mt-0.5 ${expandedJobId === job.id ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{job.jd_raw_text || job.description}</div>
                {(job.jd_raw_text || job.description || '').length > 100 && (
                  <button onClick={(e) => { e.stopPropagation(); setExpandedJobId(expandedJobId === job.id ? null : job.id) }}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1">
                    {expandedJobId === job.id ? 'Show less' : 'Read full JD...'}
                  </button>
                )}
              </div>

              {/* Stats + Actions */}
              <div className="flex items-center gap-3 text-sm text-gray-500 shrink-0">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {job.candidate_count || 0}
                </span>

                {/* Status toggle */}
                <button onClick={(e) => handleToggleStatus(e, job)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    job.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                    job.status === 'paused' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                  {job.status === 'active' ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  {job.status}
                </button>

                {/* Edit */}
                <button onClick={(e) => { e.stopPropagation(); setEditJob(job) }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                {/* Delete */}
                <button onClick={(e) => { e.stopPropagation(); setDeleteJob(job) }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                <button onClick={() => navigate(`/jobs/${job.id}`)}
                  className="p-1.5 text-gray-300 hover:text-gray-500">
                  <ChevronRight className="h-4 w-4" />
                </button>
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
    <div className="mb-6 bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="font-semibold mb-4">{step === 1 ? 'Step 1: Job Details' : 'Step 2: Upload Resumes'}</h2>

      {step === 1 && (
        <div className="space-y-3">
          <input type="text" placeholder="Job Title (e.g. Senior Backend Engineer)" value={title}
            onChange={(e) => setTitle(e.target.value)} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <textarea placeholder="Job Description" value={description} rows={3}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <textarea placeholder="Requirements (skills, experience, etc.)" value={requirements} rows={2}
            onChange={(e) => setRequirements(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Duration (min)</label>
              <input type="number" value={duration} min={10} max={60} onChange={(e) => setDuration(+e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Max Questions</label>
              <input type="number" value={maxQuestions} min={3} max={25} onChange={(e) => setMaxQuestions(+e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">JD File (optional PDF/DOCX)</label>
            <input type="file" accept=".pdf,.docx,.doc" onChange={(e) => setJdFile(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-brand-50 file:text-brand-700 file:cursor-pointer" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Upload Resumes (PDF/DOCX)</label>
            <input ref={resumeRef} type="file" multiple accept=".pdf,.docx,.doc"
              onChange={(e) => setResumes(Array.from(e.target.files))}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-brand-50 file:text-brand-700 file:cursor-pointer" />
            {resumes.length > 0 && <p className="text-xs text-gray-500 mt-1">{resumes.length} file(s) selected</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500">Candidate Emails (comma-separated, optional)</label>
            <textarea placeholder="john@email.com, jane@email.com, ..." value={emails}
              onChange={(e) => setEmails(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
      )}

      {status && <p className="text-sm text-brand-600 mt-3">{status}</p>}

      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
        {step === 1 ? (
          <button onClick={handleCreateJob} disabled={loading || !title}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {loading ? 'Creating...' : <>Next <ChevronRight className="h-3.5 w-3.5" /></>}
          </button>
        ) : (
          <>
            <button onClick={onDone} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Skip — Add Later</button>
            <button onClick={handleUploadResumes} disabled={loading || resumes.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {loading ? 'Processing...' : <><Upload className="h-3.5 w-3.5" /> Upload Resumes</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
