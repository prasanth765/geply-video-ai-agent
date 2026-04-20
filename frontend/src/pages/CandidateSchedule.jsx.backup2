import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { schedulesApi } from '../lib/api'
import { Calendar, Clock, Briefcase, Check, AlertCircle, Video, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RotateCcw, Ban, Mail, Sparkles } from 'lucide-react'

function parseUTC(dateStr) {
  if (!dateStr) return new Date()
  let s = String(dateStr).trim()
  const hasTimezone = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)
  if (!hasTimezone) {
    s = s.replace(' ', 'T')
    if (!s.includes('T')) s += 'T00:00:00'
    s += 'Z'
  }
  return new Date(s)
}

function tzLabel(tz) {
  const map = { 'Asia/Calcutta': 'IST', 'Asia/Kolkata': 'IST', 'America/New_York': 'EST', 'America/Chicago': 'CST', 'America/Denver': 'MST', 'America/Los_Angeles': 'PST', 'Europe/London': 'GMT', 'UTC': 'UTC' }
  return map[tz] || tz
}

const TIMES = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    const ampm = h >= 12 ? 'PM' : 'AM'
    TIMES.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${ampm}` })
  }
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ── Candidate-facing light canvas ──
// Soft off-white with radial gradient washes in brand colors
function CandidateCanvas({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'radial-gradient(ellipse 80% 60% at 20% 0%, #F5F0FF 0%, #FAFAFB 45%, #FFFFFF 100%)'
    }}>
      {/* Brand gradient blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, transparent 70%)',
        filter: 'blur(60px)', transform: 'translate(30%, -30%)'
      }}></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 70%)',
        filter: 'blur(60px)', transform: 'translate(-30%, 30%)'
      }}></div>
      <div className="relative z-10 py-10 px-4">
        {children}
      </div>
    </div>
  )
}

function MiniCalendar({ selected, onSelect }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const cells = []
    for (let i = 0; i < first.getDay(); i++) cells.push(null)
    for (let d = 1; d <= new Date(viewYear, viewMonth + 1, 0).getDate(); d++) cells.push(d)
    return cells
  }, [viewMonth, viewYear])
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) } else setViewMonth(viewMonth - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) } else setViewMonth(viewMonth + 1) }
  const isDisabled = (day) => { if (!day) return true; const d = new Date(viewYear, viewMonth, day); d.setHours(0,0,0,0); return d < today }
  const isSelected = (day) => day && selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day
  const isToday = (day) => day && new Date().getFullYear() === viewYear && new Date().getMonth() === viewMonth && new Date().getDate() === day
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 hover:bg-brand-50 rounded-lg transition-colors"><ChevronLeft className="h-4 w-4 text-gray-600" /></button>
        <span className="text-sm font-medium text-gray-900">{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="p-1.5 hover:bg-brand-50 rounded-lg transition-colors"><ChevronRight className="h-4 w-4 text-gray-600" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map(d => <div key={d} className="text-[10px] font-medium text-gray-400 py-1 uppercase tracking-wider">{d}</div>)}
        {days.map((day, i) => (
          <button key={i} disabled={isDisabled(day)}
            onClick={() => day && !isDisabled(day) && onSelect(new Date(viewYear, viewMonth, day))}
            className={`h-9 w-9 mx-auto rounded-lg text-sm transition-all ${
              !day ? '' :
              isDisabled(day) ? 'text-gray-300 cursor-not-allowed' :
              isSelected(day) ? 'text-white font-medium shadow-lg' :
              isToday(day) ? 'bg-brand-50 text-brand-700 font-medium hover:bg-brand-100 ring-1 ring-brand-200' :
              'text-gray-700 hover:bg-gray-100'
            }`}
            style={isSelected(day) ? { background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)' } : {}}>
            {day || ''}
          </button>
        ))}
      </div>
    </div>
  )
}

function Countdown({ targetDate }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    const tick = () => {
      const diff = parseUTC(targetDate) - new Date()
      if (diff <= 0) { setRemaining('Now!'); return }
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      const parts = []
      if (days > 0) parts.push(`${days}d`)
      if (hours > 0) parts.push(`${hours}h`)
      parts.push(`${mins}m`)
      parts.push(`${String(secs).padStart(2, '0')}s`)
      setRemaining(parts.join('  '))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [targetDate])
  return <span className="font-mono text-2xl font-medium" style={{
    background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
  }}>{remaining}</span>
}

// ── Reusable JD card — shown on every candidate view ──
function JobInfoCard({ data, jdExpanded, setJdExpanded }) {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(168,85,247,0.08)] p-6 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{
          background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)'
        }}>
          <Briefcase className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-xs text-gray-500 font-medium">{data?.company}</span>
      </div>
      <h1 className="font-serif text-[28px] leading-tight text-gray-900 mb-2 tracking-tight">{data?.job_title}</h1>
      {data?.job_description && (
        <>
          <div className={`text-sm text-gray-600 whitespace-pre-wrap leading-relaxed ${jdExpanded ? '' : 'line-clamp-3'}`}>
            {data.job_description}
          </div>
          {data.job_description.length > 150 && (
            <button
              onClick={() => setJdExpanded(!jdExpanded)}
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 mt-3 font-medium transition-colors"
            >
              {jdExpanded
                ? <><ChevronUp className="h-3 w-3" /> Show less</>
                : <><ChevronDown className="h-3 w-3" /> Read full description</>}
            </button>
          )}
        </>
      )}
    </div>
  )
}
export default function CandidateSchedule() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState('')
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [jdExpanded, setJdExpanded] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [reInterviewSent, setReInterviewSent] = useState(() => {
    try { return localStorage.getItem('geply_reinterview_' + token) === 'true' } catch { return false }
  })

  const requestReInterview = async () => {
    try { await schedulesApi.requestReInterview(token) } catch {}
    setReInterviewSent(true)
    try { localStorage.setItem('geply_reinterview_' + token, 'true') } catch {}
  }

  useEffect(() => { loadData() }, [token])

  const loadData = async () => {
    try {
      const { data: resp } = await schedulesApi.getAvailable(token)
      setData(resp)
      if (resp.already_interviewed) {
        setBooked(false); setRescheduling(false)
      } else if (resp.existing_booking) {
        setBooked(true); setRescheduling(false)
      } else {
        setBooked(false)
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Invalid or expired invite link')
    } finally { setLoading(false) }
  }

  const validate = () => {
    if (!selectedDate || !selectedTime) { setValidationError('Please select both a date and time.'); return false }
    const [hh, mm] = selectedTime.split(':').map(Number)
    const scheduled = new Date(selectedDate); scheduled.setHours(hh, mm, 0, 0)
    if (scheduled <= new Date()) { setValidationError('Selected time has already passed.'); return false }
    if ((scheduled - new Date()) / 60000 < 15) { setValidationError('Please schedule at least 15 minutes from now.'); return false }
    setValidationError(''); return true
  }

  const handleSchedule = async () => {
    if (!validate()) return
    setBooking(true); setError('')
    try {
      const [hh, mm] = selectedTime.split(':').map(Number)
      const startTime = new Date(selectedDate); startTime.setHours(hh, mm, 0, 0)
      const endTime = new Date(startTime.getTime() + 45 * 60 * 1000)
      await schedulesApi.selfSchedule({
        candidate_token: token,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      setSelectedDate(null); setSelectedTime('')
      await loadData()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Scheduling failed.')
    } finally { setBooking(false) }
  }

  const goToInterview = () => navigate(`/interview/${token}`)

  const availableTimes = useMemo(() => {
    if (!selectedDate) return TIMES
    if (selectedDate.toDateString() !== new Date().toDateString()) return TIMES
    return TIMES.filter(t => {
      const [hh, mm] = t.value.split(':').map(Number)
      const check = new Date(selectedDate); check.setHours(hh, mm, 0, 0)
      return check > new Date(Date.now() + 15 * 60 * 1000)
    })
  }, [selectedDate])

  // ── Loading ──
  if (loading) return (
    <CandidateCanvas>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block w-10 h-10 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin mb-3"></div>
          <p className="text-sm text-gray-500">Loading your interview...</p>
        </div>
      </div>
    </CandidateCanvas>
  )

  // ── Error ──
  if (error && !data) return (
    <CandidateCanvas>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(168,85,247,0.08)] p-8">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="font-serif text-2xl text-gray-900 mb-2 tracking-tight">Something went wrong</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    </CandidateCanvas>
  )

  // ── Already interviewed ──
  if (data?.already_interviewed) return (
    <CandidateCanvas>
      <div className="max-w-lg mx-auto">
        <JobInfoCard data={data} jdExpanded={jdExpanded} setJdExpanded={setJdExpanded} />
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(168,85,247,0.08)] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Ban className="h-7 w-7 text-gray-500" />
          </div>
          <h2 className="font-serif text-2xl text-gray-900 mb-2 tracking-tight">Interview completed</h2>
          <p className="text-gray-600 text-sm mb-1">
            You've completed your interview for{' '}
            <span className="font-medium text-gray-900">{data.job_title}</span>.
          </p>
          <p className="text-xs text-gray-400 mb-5">The recruiter will review and get back to you.</p>
          {!reInterviewSent ? (
            <button onClick={requestReInterview}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all">
              <Mail className="h-4 w-4" /> Request re-interview
            </button>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-sm text-emerald-700 font-medium flex items-center justify-center gap-1.5"><Check className="h-4 w-4" /> Request sent</p>
              <p className="text-xs text-emerald-600 mt-1">The recruiter has been notified.</p>
            </div>
          )}
        </div>
      </div>
    </CandidateCanvas>
  )

  // ── Already booked — show confirmation ──
  if (booked && !rescheduling && data?.existing_booking) {
    const bk = data.existing_booking
    const startDate = parseUTC(bk.start_time)
    const isPast = startDate < new Date(Date.now() - 5 * 60 * 1000)

    return (
      <CandidateCanvas>
        <div className="max-w-lg mx-auto">
          <JobInfoCard data={data} jdExpanded={jdExpanded} setJdExpanded={setJdExpanded} />

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(168,85,247,0.08)] p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{
              background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
              boxShadow: '0 8px 24px rgba(168, 85, 247, 0.35)'
            }}>
              <Check className="h-8 w-8 text-white" strokeWidth={2.5} />
            </div>
            <h2 className="font-serif text-[28px] leading-tight text-gray-900 mb-5 tracking-tight">You're all set</h2>

            <div className="rounded-2xl p-5 mb-5" style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.05) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.15)'
            }}>
              <p className="text-sm font-medium text-brand-700 mb-1">
                {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="font-serif text-[32px] leading-tight text-gray-900 tracking-tight">
                {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
              <p className="text-xs text-brand-600 mt-1 font-medium">{tzLabel(bk.timezone)}</p>
            </div>

            {!isPast && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-5">
                <p className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Starts in</p>
                <Countdown targetDate={bk.start_time} />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={goToInterview}
                className="flex-1 px-4 py-3 text-white rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
                  boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)'
                }}>
                {isPast ? 'Start interview now' : 'Enter interview room'}
              </button>
              <button onClick={() => { setRescheduling(true); setSelectedDate(null); setSelectedTime('') }}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all">
                <RotateCcw className="h-3.5 w-3.5" /> Reschedule
              </button>
            </div>
          </div>
        </div>
      </CandidateCanvas>
    )
  }

  // ── Scheduling / Rescheduling form ──
  return (
    <CandidateCanvas>
      <div className="max-w-lg mx-auto">

        <JobInfoCard data={data} jdExpanded={jdExpanded} setJdExpanded={setJdExpanded} />

        {rescheduling && (
          <div className="bg-amber-50/80 backdrop-blur-xl border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <RotateCcw className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Rescheduling</p>
              <p className="text-xs text-amber-700 mt-0.5">Pick a new date and time. Your previous booking will be replaced.</p>
            </div>
            <button onClick={() => { setRescheduling(false); setBooked(true) }}
              className="text-xs text-amber-700 hover:text-amber-900 shrink-0 font-medium">Cancel</button>
          </div>
        )}

        {!rescheduling && (
          <>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border-2 shadow-[0_8px_30px_rgba(168,85,247,0.1)] p-6 mb-5" style={{
              borderImage: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%) 1',
              borderColor: 'rgba(168, 85, 247, 0.2)'
            }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{
                  background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
                  boxShadow: '0 4px 14px rgba(168, 85, 247, 0.3)'
                }}>
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-serif text-xl text-gray-900 tracking-tight">Available now?</h2>
                  <p className="text-xs text-gray-500">Our AI interviewer is ready 24/7</p>
                </div>
              </div>
              <button onClick={goToInterview}
                className="w-full py-3 text-white rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
                  boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)'
                }}>
                <Video className="h-4 w-4" /> Start interview now
              </button>
            </div>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              <span className="text-[10px] text-gray-400 uppercase tracking-[0.15em] font-medium">or schedule for later</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            </div>
          </>
        )}

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(168,85,247,0.08)] p-6">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-brand-500" />
            <h2 className="font-serif text-xl text-gray-900 tracking-tight">
              {rescheduling ? 'Pick new date & time' : 'Pick a date & time'}
            </h2>
          </div>
          <p className="text-xs text-gray-500 mb-5">AI interviews available 24/7</p>

          <MiniCalendar selected={selectedDate} onSelect={(d) => { setSelectedDate(d); setSelectedTime(''); setValidationError('') }} />

          {selectedDate && (
            <div className="mt-5">
              <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="h-3 w-3 text-brand-500" />
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              {availableTimes.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-100">No times available for today. Select another date.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-52 overflow-auto pr-1">
                  {availableTimes.map(t => (
                    <button key={t.value} onClick={() => { setSelectedTime(t.value); setValidationError('') }}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        selectedTime === t.value
                          ? 'text-white shadow-lg'
                          : 'bg-gray-50 text-gray-700 hover:bg-brand-50 hover:text-brand-600 border border-gray-200 hover:border-brand-200'
                      }`}
                      style={selectedTime === t.value ? { background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)' } : {}}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {validationError && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{validationError}
            </div>
          )}
          {error && data && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
            </div>
          )}

          {selectedDate && selectedTime && (
            <div className="mt-4 p-4 rounded-xl border" style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.06) 0%, rgba(236, 72, 153, 0.04) 100%)',
              borderColor: 'rgba(168, 85, 247, 0.2)'
            }}>
              <p className="text-sm font-medium text-brand-700">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} at {TIMES.find(t => t.value === selectedTime)?.label}
              </p>
              <p className="text-xs text-brand-600 mt-0.5">45-minute AI interview · {tzLabel(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p>
            </div>
          )}

          <button onClick={handleSchedule} disabled={!selectedDate || !selectedTime || booking}
            className="w-full mt-5 py-3 text-white rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            style={{
              background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
              boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)'
            }}>
            {booking ? 'Scheduling...' : rescheduling ? 'Confirm reschedule' : 'Confirm schedule'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Powered by Geply</p>
      </div>
    </CandidateCanvas>
  )
}