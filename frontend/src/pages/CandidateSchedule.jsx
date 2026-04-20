import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { schedulesApi } from '../lib/api'
import { Calendar, Clock, Briefcase, Check, AlertCircle, Video, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RotateCcw, Ban, Mail } from 'lucide-react'

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
        <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft className="h-4 w-4 text-gray-500" /></button>
        <span className="text-sm font-semibold">{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronRight className="h-4 w-4 text-gray-500" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map(d => <div key={d} className="text-[10px] font-medium text-gray-400 py-1">{d}</div>)}
        {days.map((day, i) => (
          <button key={i} disabled={isDisabled(day)}
            onClick={() => day && !isDisabled(day) && onSelect(new Date(viewYear, viewMonth, day))}
            className={`h-9 w-9 mx-auto rounded-lg text-sm transition-colors ${!day ? '' : isDisabled(day) ? 'text-gray-300 cursor-not-allowed' : isSelected(day) ? 'bg-blue-500 text-white font-semibold' : isToday(day) ? 'bg-blue-50 text-blue-600 font-medium hover:bg-blue-100' : 'text-gray-700 hover:bg-gray-100'}`}>
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
  return <span className="font-mono text-2xl font-bold text-red-600">{remaining}</span>
}

// ── Reusable JD card ───────────────────────────────────────────────────────
// Shows job title, company, and expandable job description.
// Used on EVERY screen — booking confirmation, rescheduling, scheduling form.
function JobInfoCard({ data, jdExpanded, setJdExpanded }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Briefcase className="h-5 w-5 text-blue-500" />
        <span className="text-xs text-gray-500">{data?.company}</span>
      </div>
      <h1 className="text-xl font-semibold mb-2">{data?.job_title}</h1>
      {data?.job_description && (
        <>
          <div className={`text-sm text-gray-500 whitespace-pre-wrap ${jdExpanded ? '' : 'line-clamp-3'}`}>
            {data.job_description}
          </div>
          {data.job_description.length > 150 && (
            <button
              onClick={() => setJdExpanded(!jdExpanded)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2 font-medium"
            >
              {jdExpanded
                ? <><ChevronUp className="h-3 w-3" /> Show less</>
                : <><ChevronDown className="h-3 w-3" /> Read full JD</>}
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )
  if (error && !data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <h2 className="font-semibold text-lg mb-2">Oops</h2>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    </div>
  )

  // ── Already interviewed ────────────────────────────────────────
  if (data?.already_interviewed) return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <JobInfoCard data={data} jdExpanded={jdExpanded} setJdExpanded={setJdExpanded} />
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Ban className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="font-semibold text-lg mb-2">Interview Completed</h2>
          <p className="text-gray-500 text-sm mb-2">
            You have already completed your interview for{' '}
            <span className="font-medium text-gray-700">{data.job_title}</span>.
          </p>
          <p className="text-xs text-gray-400 mb-4">The recruiter will review your interview and get back to you.</p>
          {!reInterviewSent ? (
            <button onClick={requestReInterview}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <Mail className="h-4 w-4" /> Request Re-interview
            </button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700 font-medium">Request sent!</p>
              <p className="text-xs text-green-600 mt-0.5">The recruiter has been notified and will send a new invite if approved.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── Already booked — show confirmation ─────────────────────────
  if (booked && !rescheduling && data?.existing_booking) {
    const bk = data.existing_booking
    const startDate = parseUTC(bk.start_time)
    const isPast = startDate < new Date(Date.now() - 5 * 60 * 1000)

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-lg mx-auto">

          {/* ── JD card — always shown ── */}
          <JobInfoCard data={data} jdExpanded={jdExpanded} setJdExpanded={setJdExpanded} />

          {/* ── Booking confirmation ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="font-semibold text-lg mb-4">Interview Scheduled!</h2>

            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-blue-800">
                {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-lg font-semibold text-blue-900 mt-1">
                {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
              <p className="text-xs text-blue-500 mt-1">{tzLabel(bk.timezone)}</p>
            </div>

            {!isPast && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-xs font-medium text-red-500 mb-1 uppercase tracking-wide">⏱ Interview starts in</p>
                <Countdown targetDate={bk.start_time} />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={goToInterview}
                className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                {isPast ? 'Start Interview Now' : 'Enter Interview Room'}
              </button>
              <button onClick={() => { setRescheduling(true); setSelectedDate(null); setSelectedTime('') }}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                <RotateCcw className="h-3.5 w-3.5" /> Reschedule
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Scheduling / Rescheduling form ────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">

        {/* ── JD card — always shown ── */}
        <JobInfoCard data={data} jdExpanded={jdExpanded} setJdExpanded={setJdExpanded} />

        {rescheduling && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <RotateCcw className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-800">Rescheduling</p>
              <p className="text-xs text-orange-600 mt-0.5">Pick a new date and time. Your previous booking will be replaced.</p>
            </div>
            <button onClick={() => { setRescheduling(false); setBooked(true) }}
              className="ml-auto text-xs text-orange-600 hover:text-orange-800 shrink-0">Cancel</button>
          </div>
        )}

        {!rescheduling && (
          <>
            <div className="bg-white rounded-xl border-2 border-green-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Video className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold">Available now?</h2>
                  <p className="text-xs text-gray-500">Our AI interviewer is ready 24/7</p>
                </div>
              </div>
              <button onClick={goToInterview}
                className="w-full py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                Start Interview Now
              </button>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 uppercase">or schedule for later</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            {rescheduling ? 'Pick new date & time' : 'Pick a date & time'}
          </h2>
          <p className="text-xs text-gray-500 mb-4">AI interviews available 24/7</p>

          <MiniCalendar selected={selectedDate} onSelect={(d) => { setSelectedDate(d); setSelectedTime(''); setValidationError('') }} />

          {selectedDate && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              {availableTimes.length === 0 ? (
                <p className="text-sm text-orange-500 bg-orange-50 p-3 rounded-lg">No times available for today. Select another date.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-52 overflow-auto">
                  {availableTimes.map(t => (
                    <button key={t.value} onClick={() => { setSelectedTime(t.value); setValidationError('') }}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${selectedTime === t.value ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-200'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {validationError && (
            <div className="mt-3 text-sm text-red-500 bg-red-50 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{validationError}
            </div>
          )}
          {error && data && (
            <div className="mt-3 text-sm text-red-500 bg-red-50 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
            </div>
          )}

          {selectedDate && selectedTime && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm font-medium text-blue-800">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} at {TIMES.find(t => t.value === selectedTime)?.label}
              </p>
              <p className="text-xs text-blue-500 mt-0.5">45-minute AI interview · {tzLabel(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p>
            </div>
          )}

          <button onClick={handleSchedule} disabled={!selectedDate || !selectedTime || booking}
            className="w-full mt-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {booking ? 'Scheduling...' : rescheduling ? 'Confirm Reschedule' : 'Confirm Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
