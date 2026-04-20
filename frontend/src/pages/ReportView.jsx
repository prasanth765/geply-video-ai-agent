import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { reportsApi } from '../lib/api'
import {
  FileText, Star, Shield, AlertTriangle, CheckCircle, XCircle,
  MinusCircle, MessageSquare, ChevronDown, ChevronUp, Download,
  Camera, Target, Brain, TrendingUp, HelpCircle, Zap, Users,
  Briefcase, ClipboardCheck, DollarSign, UserCheck
} from 'lucide-react'

const VERDICT_CONFIG = {
  strong_yes: { label: 'Strong Yes', color: 'text-green-600 bg-green-100', icon: CheckCircle },
  yes:        { label: 'Yes',        color: 'text-green-500 bg-green-50',  icon: CheckCircle },
  maybe:      { label: 'Maybe',      color: 'text-yellow-600 bg-yellow-100', icon: MinusCircle },
  no:         { label: 'No',         color: 'text-red-500 bg-red-50',     icon: XCircle },
  strong_no:  { label: 'Strong No',  color: 'text-red-600 bg-red-100',    icon: XCircle },
}

const ACTION_LABELS = {
  advance_to_next_round: { label: 'Advance to Next Round', color: 'bg-green-100 text-green-700' },
  human_deep_dive:       { label: 'Human Deep Dive Needed', color: 'bg-blue-100 text-blue-700' },
  re_interview:          { label: 'Re-interview Recommended', color: 'bg-yellow-100 text-yellow-700' },
  archive_reject:        { label: 'Archive / Reject', color: 'bg-red-100 text-red-700' },
}

const RISK_COLORS = {
  low:     'bg-green-100 text-green-700',
  medium:  'bg-yellow-100 text-yellow-700',
  high:    'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-600',
}

const SEVERITY_COLORS = {
  green:  'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  red:    'bg-red-100 text-red-700 border-red-200',
}

/* ── Score Card with optional "Why this score?" evidence ── */
function ScoreCard({ label, value, max = 100, evidence }) {
  const [showEvidence, setShowEvidence] = useState(false)
  const pct = max > 0 ? (value / max) * 100 : 0
  const barColor = value >= 70 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : value >= 25 ? 'bg-orange-500' : 'bg-red-500'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-semibold">{Math.round(value)}</span>
        <span className="text-sm text-gray-400 mb-0.5">/{max}</span>
      </div>
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {evidence && (
        <button onClick={() => setShowEvidence(!showEvidence)}
          className="mt-2 flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 transition-colors">
          <HelpCircle className="h-3 w-3" />
          {showEvidence ? 'Hide evidence' : 'Why this score?'}
        </button>
      )}
      {showEvidence && evidence && (
        <p className="mt-1.5 text-[11px] text-gray-500 bg-gray-50 rounded-lg p-2 leading-relaxed">{evidence}</p>
      )}
    </div>
  )
}

/* ── Transcript Viewer ── */
function TranscriptViewer({ transcript }) {
  const [expanded, setExpanded] = useState(false)
  if (!transcript || !transcript.trim()) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-blue-500" /> Interview Transcript</h2>
        <p className="text-sm text-gray-400 italic">No transcript recorded.</p>
      </div>
    )
  }
  const lines = transcript.split('\n').filter(l => l.trim())
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-blue-500" /> Interview Transcript</h2>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
          {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Collapse</> : <><ChevronDown className="h-3.5 w-3.5" /> Expand</>}
        </button>
      </div>
      <div className={`space-y-3 ${expanded ? '' : 'max-h-64 overflow-hidden relative'}`}>
        {lines.map((line, i) => {
          const isInterviewer = line.trim().startsWith('Interviewer:')
          const isCandidate = line.trim().startsWith('Candidate:')
          const content = line.replace(/^(Interviewer|Candidate):\s*/, '').trim()
          return (
            <div key={i} className={`flex ${isCandidate ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                isInterviewer ? 'bg-gray-100 text-gray-700' : isCandidate ? 'bg-blue-50 text-blue-900 border border-blue-100' : 'bg-gray-50 text-gray-500'
              }`}>
                <span className={`text-[10px] font-medium uppercase tracking-wide block mb-0.5 ${
                  isInterviewer ? 'text-gray-400' : isCandidate ? 'text-blue-400' : 'text-gray-400'
                }`}>{isInterviewer ? 'Geply AI' : isCandidate ? 'Candidate' : ''}</span>
                {content}
              </div>
            </div>
          )
        })}
        {!expanded && lines.length > 4 && <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />}
      </div>
      {!expanded && lines.length > 4 && (
        <button onClick={() => setExpanded(true)} className="mt-2 text-xs text-blue-600 hover:text-blue-800">
          Show full transcript ({lines.length} messages)
        </button>
      )}
    </div>
  )
}

/* ── Enhanced Integrity Breakdown ── */
function IntegrityBreakdown({ breakdown, proctorFlags }) {
  if (!breakdown && (!proctorFlags || proctorFlags.length === 0)) return null

  const deductions = breakdown?.deductions || []
  const severity = breakdown?.severity_summary || {}

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <h2 className="font-semibold mb-4 flex items-center gap-1.5">
        <Shield className="h-4 w-4 text-blue-500" /> Integrity Analysis
      </h2>

      {breakdown && (
        <div className="mb-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="text-center">
              <span className="text-3xl font-bold">{breakdown.composite_score}</span>
              <span className="text-sm text-gray-400">/100</span>
            </div>
            <div className="flex gap-2">
              {severity.green > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">{severity.green} low</span>}
              {severity.yellow > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 text-yellow-700">{severity.yellow} medium</span>}
              {severity.red > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700">{severity.red} high</span>}
            </div>
          </div>

          {deductions.length > 0 && (
            <div className="space-y-1.5">
              {deductions.map((d, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${SEVERITY_COLORS[d.severity] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  <span className="font-medium">{d.event_type?.replace(/_/g, ' ')}</span>
                  <span>{d.count}x = -{d.total_penalty} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw events fallback for old reports */}
      {!breakdown && proctorFlags && proctorFlags.length > 0 && (
        <div className="space-y-2">
          {proctorFlags.map((flag, i) => {
            const flagType = typeof flag === 'string' ? flag : (flag.event_type || flag.type || JSON.stringify(flag))
            const flagTime = typeof flag === 'object' ? (flag.timestamp || '') : ''
            return (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                <span className="font-medium">{flagType}</span>
                {flagTime && <span className="text-gray-400 text-xs ml-auto">{flagTime}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function downloadReportHTML(report, breakdown, recs, skillGaps, plainVerdict) {
  const verdict = report.verdict?.replace('_', ' ') || 'N/A'
  const vc = ['strong_yes','yes'].includes(report.verdict) ? '#059669' : report.verdict === 'maybe' ? '#D97706' : '#DC2626'

  const scoreCard = (label, key) => {
    const val = breakdown[key]
    if (val === undefined) return ''
    const ev = breakdown[`${key}_evidence`] || ''
    const bc = val >= 70 ? '#059669' : val >= 50 ? '#D97706' : val >= 25 ? '#F97316' : '#DC2626'
    return `<div class="sc">
      <div class="sc-head"><span>${label}</span><span class="sc-val">${Math.round(val)}<small>/100</small></span></div>
      <div class="bar"><div class="bar-fill" style="width:${val}%;background:${bc}"></div></div>
      ${ev ? `<div class="evidence">${ev}</div>` : ''}
    </div>`
  }

  const qaCards = (report.key_qa_pairs || []).map(qa => {
    const sc = qa.score != null ? qa.score : null
    const badge = sc !== null ? `<span class="qa-score ${sc >= 7 ? 'qa-good' : sc >= 4 ? 'qa-mid' : 'qa-low'}">${sc}/10</span>` : ''
    return `<div class="qa">
      <div class="qa-head"><span>Q: ${qa.question || ''}</span>${badge}</div>
      <p class="qa-ans">A: ${qa.answer_summary || ''}</p>
      ${qa.evidence_quote ? `<p class="evidence">"${qa.evidence_quote}"</p>` : ''}
    </div>`
  }).join('')

  const transcriptHTML = report.transcript ? report.transcript.split('\n').filter(l => l.trim()).map(line => {
    const isAI = line.trim().startsWith('Interviewer:')
    const content = line.replace(/^(Interviewer|Candidate):\s*/, '').trim()
    return `<div class="msg ${isAI ? 'msg-ai' : 'msg-cand'}"><small>${isAI ? 'Geply AI' : 'Candidate'}</small>${content}</div>`
  }).join('') : '<p class="muted">No transcript recorded.</p>'

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Interview Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;color:#1a1a2e;background:#f8f9fc;line-height:1.6}
.wrap{max-width:820px;margin:0 auto;padding:32px 24px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.header h1{font-size:24px;font-weight:700;color:#1a1a2e}
.badge{display:inline-block;padding:6px 20px;border-radius:24px;font-weight:700;font-size:13px;color:#fff;background:${vc};letter-spacing:0.5px;text-transform:uppercase}
.meta{font-size:12px;color:#8b8fa3;margin-bottom:24px}
.verdict-banner{background:linear-gradient(135deg,#eef2ff,#e0e7ff);border:1px solid #c7d2fe;border-radius:12px;padding:16px 20px;margin-bottom:24px;font-weight:600;color:#3730a3;font-size:14px}
.warn-banner{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:24px;color:#92400e;font-size:13px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
.big-card{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb}
.big-card .label{font-size:11px;color:#8b8fa3;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px}
.big-card .num{font-size:36px;font-weight:700} .big-card .num small{font-size:14px;color:#c4c7d4;margin-left:2px}
h2{font-size:15px;font-weight:700;color:#1a1a2e;margin:28px 0 14px;padding-bottom:8px;border-bottom:1px solid #eef0f5}
.sc{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e5e7eb;margin-bottom:10px}
.sc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.sc-head span{font-size:13px;font-weight:600;color:#374151}
.sc-val{font-size:18px;font-weight:700;color:#1a1a2e} .sc-val small{font-size:11px;color:#c4c7d4}
.bar{height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden;margin-bottom:6px}
.bar-fill{height:100%;border-radius:3px;transition:width 0.4s}
.evidence{font-size:11px;color:#6b7280;background:#f9fafb;border-radius:6px;padding:8px 10px;margin-top:6px;line-height:1.5;border-left:3px solid #818cf8}
.gap-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:24px}
.gap-tag{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:500}
.summary{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;margin-bottom:24px;font-size:14px;color:#374151;white-space:pre-wrap}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.col{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb}
.col h3{font-size:13px;font-weight:700;margin-bottom:10px}
.col li{font-size:13px;margin-bottom:6px;padding-left:4px;list-style:none}
.s-icon{color:#059669;margin-right:4px} .w-icon{color:#dc2626;margin-right:4px}
.qa{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e5e7eb;margin-bottom:10px}
.qa-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;font-size:13px;font-weight:600}
.qa-score{padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap}
.qa-good{background:#dcfce7;color:#166534} .qa-mid{background:#fef9c3;color:#854d0e} .qa-low{background:#fee2e2;color:#991b1b}
.qa-ans{font-size:13px;color:#4b5563}
.recs{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;margin-bottom:24px}
.recs-tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.recs-tag{padding:4px 14px;border-radius:8px;font-size:12px;font-weight:600}
.action-tag{background:#e0e7ff;color:#3730a3} .risk-low{background:#dcfce7;color:#166534} .risk-med{background:#fef9c3;color:#854d0e} .risk-high{background:#fee2e2;color:#991b1b}
.probe{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;margin-top:12px}
.probe h4{font-size:12px;font-weight:700;color:#1e40af;margin-bottom:8px}
.probe ol{padding-left:18px;font-size:13px;color:#1e3a5f} .probe li{margin-bottom:4px}
.transcript{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;margin-bottom:24px;max-height:500px;overflow-y:auto}
.msg{padding:8px 14px;border-radius:8px;margin-bottom:6px;font-size:13px}
.msg small{display:block;font-size:10px;color:#9ca3af;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px}
.msg-ai{background:#f3f4f6;text-align:left} .msg-cand{background:#eff6ff;text-align:right;margin-left:15%}
.muted{color:#9ca3af;font-style:italic;font-size:13px}
.footer{text-align:center;font-size:11px;color:#c4c7d4;margin-top:40px;padding-top:20px;border-top:1px solid #eef0f5}
@media print{body{background:#fff} .wrap{padding:16px} .transcript{max-height:none;overflow:visible}}
</style></head><body><div class="wrap">

<div class="header"><h1>Interview Report</h1><span class="badge">${verdict}</span></div>
<p class="meta">Generated ${new Date(report.created_at).toLocaleString()} by Geply AI</p>

${plainVerdict ? `<div class="verdict-banner">${plainVerdict}</div>` : ''}
${report.summary?.includes('Insufficient') ? `<div class="warn-banner">The candidate did not provide enough responses for a full evaluation.</div>` : ''}

<div class="grid2">
  <div class="big-card"><div class="label">Overall score</div><div class="num">${Math.round(report.overall_score)}<small>/100</small></div></div>
  <div class="big-card"><div class="label">Integrity score</div><div class="num">${Math.round(report.integrity_score)}<small>/100</small></div></div>
</div>

<h2>Score breakdown</h2>
${scoreCard('Technical', 'technical')}
${scoreCard('Communication', 'communication')}
${scoreCard('Problem solving', 'problem_solving')}
${scoreCard('Domain knowledge', 'domain_knowledge')}
${scoreCard('Cultural fit', 'cultural_fit')}

${skillGaps.length > 0 ? `<h2>Skill gaps vs job description</h2><div class="gap-tags">${skillGaps.map(g => `<span class="gap-tag">${g}</span>`).join('')}</div>` : ''}

<h2>Summary</h2>
<div class="summary">${(report.summary || '').replace(/\n/g, '<br>')}</div>

<div class="cols">
  <div class="col"><h3 style="color:#059669">Strengths</h3><ul>${(report.strengths || []).map(s => `<li><span class="s-icon">&#10003;</span>${typeof s === 'string' ? s : JSON.stringify(s)}</li>`).join('') || '<li class="muted">None demonstrated</li>'}</ul></div>
  <div class="col"><h3 style="color:#dc2626">Areas for improvement</h3><ul>${(report.weaknesses || []).map(w => `<li><span class="w-icon">&#10007;</span>${typeof w === 'string' ? w : JSON.stringify(w)}</li>`).join('') || '<li class="muted">None recorded</li>'}</ul></div>
</div>

${qaCards ? `<h2>Key Q&A highlights</h2>${qaCards}` : ''}

${recs ? `<div class="recs"><h2 style="margin-top:0;border:none;padding:0">Recommendations</h2>
<div class="recs-tags">
  ${recs.verdict_action ? `<span class="recs-tag action-tag">${recs.verdict_action.replace(/_/g, ' ')}</span>` : ''}
  ${recs.engagement_risk ? `<span class="recs-tag ${recs.engagement_risk === 'high' ? 'risk-high' : recs.engagement_risk === 'medium' ? 'risk-med' : 'risk-low'}">Engagement risk: ${recs.engagement_risk}</span>` : ''}
</div>
${recs.rationale ? `<p style="font-size:14px;color:#374151;margin-bottom:12px">${recs.rationale}</p>` : ''}
${recs.suggested_probe_questions?.length > 0 ? `<div class="probe"><h4>Suggested follow-up questions for human interviewer</h4><ol>${recs.suggested_probe_questions.map(q => `<li>${q}</li>`).join('')}</ol></div>` : ''}
</div>` : ''}

<h2>Full transcript</h2>
<div class="transcript">${transcriptHTML}</div>

<div class="footer">Generated by Geply &mdash; AI Interview Platform by GEP</div>
</div></body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `geply-report-${report.id.slice(0, 8)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Main Report View ── */

/* -- Categorized Q&A Section -- */
const CATEGORY_META = {
  hygiene:         { label: 'Hygiene',          icon: ClipboardCheck, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  jd_fit:          { label: 'JD Questions',     icon: Briefcase,      color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  resume_verify:   { label: 'Resume Verify',    icon: UserCheck,      color: 'text-teal-600 bg-teal-50 border-teal-200' },
  ctc:             { label: 'CTC Details',      icon: DollarSign,     color: 'text-green-600 bg-green-50 border-green-200' },
  recruiter_custom:{ label: 'Recruiter Qs',     icon: MessageSquare,  color: 'text-purple-600 bg-purple-50 border-purple-200' },
}

function QACategorySection({ qaByCategory }) {
  // Determine which tabs to show (skip empty categories)
  const availableTabs = Object.keys(CATEGORY_META).filter(key => {
    const items = qaByCategory?.[key]
    return Array.isArray(items) && items.length > 0
  })

  const [activeTab, setActiveTab] = useState(availableTabs[0] || null)

  if (availableTabs.length === 0) return null

  const currentItems = qaByCategory[activeTab] || []
  const ActiveIcon = CATEGORY_META[activeTab]?.icon || MessageSquare

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <h2 className="font-semibold mb-4 flex items-center gap-1.5">
        <MessageSquare className="h-4 w-4 text-blue-500" /> Interview Q&amp;A by Category
      </h2>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-100 pb-3">
        {availableTabs.map(key => {
          const meta = CATEGORY_META[key]
          const Icon = meta.icon
          const count = qaByCategory[key]?.length || 0
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                isActive
                  ? meta.color + ' border-current'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                isActive ? 'bg-white/60' : 'bg-gray-200 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active tab content */}
      <div className="space-y-3">
        {currentItems.map((qa, i) => {
          const isCtc = activeTab === 'ctc'
          const scoreNum = typeof qa.score === 'number' ? qa.score : null
          return (
            <div key={i} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="text-xs font-semibold text-gray-400 shrink-0 mt-0.5">Q{i + 1}.</span>
                  <p className="text-sm font-medium text-gray-900">{qa.question || '(question not captured)'}</p>
                </div>
                {!isCtc && scoreNum !== null && scoreNum > 0 && (
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    scoreNum >= 8 ? 'bg-green-100 text-green-700' :
                    scoreNum >= 5 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                  }`}>{scoreNum}/10</span>
                )}
              </div>
              <div className="pl-6">
                {isCtc ? (
                  <div className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium ${
                    qa.answer === 'Declined' ? 'bg-gray-100 text-gray-600' :
                    qa.answer === 'Not asked' ? 'bg-gray-50 text-gray-400 italic' :
                                                'bg-green-50 text-green-800 border border-green-200'
                  }`}>
                    {qa.answer || '-'}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 leading-relaxed">
                    <span className="text-gray-400 font-medium">A: </span>
                    {qa.answer || qa.answer_summary || '(no answer recorded)'}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ReportView() {
  const { reportId } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadReport() }, [reportId])

  const loadReport = async () => {
    try {
      const { data } = await reportsApi.get(reportId)
      setReport(data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  if (loading) return <div className="p-6 text-gray-400">Loading report...</div>
  if (!report) return <div className="p-6 text-red-500">Report not found</div>

  const verdict = VERDICT_CONFIG[report.verdict] || VERDICT_CONFIG.maybe
  const VerdictIcon = verdict.icon
  const breakdown = report.score_breakdown || {}
  const isInsufficient = report.summary?.includes('Insufficient interview data')
  const screenshots = report.screenshots || []

  // Enhanced fields (backward-compatible: may not exist in old reports)
  const plainVerdict = breakdown.plain_language_verdict || report.plain_language_verdict || null
  const skillGapsRaw = report.skill_gaps || breakdown.skill_gaps || []
  const skillGaps = typeof skillGapsRaw === 'string' ? (() => { try { return JSON.parse(skillGapsRaw) } catch { return [] } })() : skillGapsRaw
  const integrityBreakdown = breakdown.integrity_breakdown || null
  // Recommendations may be a JSON string (from DB) or already an object
  const recsRaw = report.recommendations
  let recs = null
  let recsText = null
  if (typeof recsRaw === 'object' && recsRaw !== null) {
    recs = recsRaw
  } else if (typeof recsRaw === 'string') {
    try {
      const parsed = JSON.parse(recsRaw)
      if (typeof parsed === 'object' && parsed !== null) recs = parsed
      else recsText = recsRaw
    } catch {
      recsText = recsRaw
    }
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-printable, #report-printable * { visibility: visible; }
          #report-printable { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="report-printable" className="p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-500" />
            <h1 className="text-xl font-semibold">Interview Report</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => downloadReportHTML(report, breakdown, recs, skillGaps, plainVerdict)}
              className="no-print flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
              <Download className="h-3.5 w-3.5" /> Download Report
            </button>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${verdict.color}`}>
              <VerdictIcon className="h-4 w-4" />
              {verdict.label}
            </div>
          </div>
        </div>

        {/* Plain Language Verdict (new) */}
        {plainVerdict && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Brain className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-blue-800">{plainVerdict}</p>
          </div>
        )}

        {/* Insufficient banner */}
        {isInsufficient && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-800">Insufficient Interview</p>
              <p className="text-xs text-orange-600 mt-0.5">The candidate did not provide enough responses. Review the transcript below.</p>
            </div>
          </div>
        )}

        {/* Primary Scores */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <ScoreCard label="Overall Score" value={report.overall_score} />
          <ScoreCard label="Integrity Score" value={report.integrity_score} />
        </div>

        {/* Score Breakdown with Evidence */}
        {Object.keys(breakdown).length > 0 && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { key: 'technical',        label: 'Technical' },
              { key: 'communication',    label: 'Communication' },
              { key: 'problem_solving',  label: 'Problem Solving' },
              { key: 'domain_knowledge', label: 'Domain Knowledge' },
              { key: 'cultural_fit',     label: 'Cultural Fit' },
            ].filter(({ key }) => breakdown[key] !== undefined).map(({ key, label }) => (
              <ScoreCard
                key={key}
                label={label}
                value={breakdown[key]}
                evidence={breakdown[`${key}_evidence`]}
              />
            ))}
          </div>
        )}

        {/* Skill Gaps (new) */}
        {skillGaps.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-orange-500" /> Skill Gaps vs Job Description
            </h2>
            <div className="space-y-2">
              {skillGaps.map((gap, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-orange-50 px-3 py-2 rounded-lg border border-orange-100">
                  <XCircle className="h-3.5 w-3.5 text-orange-400 mt-0.5 shrink-0" />
                  {gap}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-3">Summary</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{report.summary}</p>
        </div>

        {/* Transcript */}
        <TranscriptViewer transcript={report.transcript} />

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-1.5"><Star className="h-4 w-4" /> Strengths</h3>
            <ul className="space-y-2">
              {(report.strengths || []).map((s, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                  {typeof s === 'string' ? s : JSON.stringify(s)}
                </li>
              ))}
              {(!report.strengths || report.strengths.length === 0) && <li className="text-sm text-gray-400 italic">No strengths demonstrated</li>}
            </ul>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Areas for Improvement</h3>
            <ul className="space-y-2">
              {(report.weaknesses || []).map((w, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                  {typeof w === 'string' ? w : JSON.stringify(w)}
                </li>
              ))}
              {(!report.weaknesses || report.weaknesses.length === 0) && <li className="text-sm text-gray-400 italic">No areas recorded</li>}
            </ul>
          </div>
        </div>

        {/* Categorized Q&A Section (new) - falls back gracefully if data missing */}
        {report.qa_by_category && <QACategorySection qaByCategory={report.qa_by_category} />}

        {/* Key Q&A with Evidence */}
        {report.key_qa_pairs && report.key_qa_pairs.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-blue-500" /> Key Q&A Highlights</h2>
            <div className="space-y-4">
              {report.key_qa_pairs.map((qa, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-medium text-gray-900">Q: {qa.question || ''}</p>
                    {qa.score != null && (
                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        qa.score >= 8 ? 'bg-green-100 text-green-700' : qa.score >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>{qa.score}/10</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">A: {qa.answer_summary || qa.answer || ''}</p>
                  {qa.evidence_quote && (
                    <p className="mt-2 text-[11px] text-gray-400 italic bg-gray-50 px-2 py-1 rounded">
                      "{qa.evidence_quote}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Recommendations (new structured format) */}
        {recs && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-blue-500" /> Recommendations & Next Steps
            </h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {recs.verdict_action && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ACTION_LABELS[recs.verdict_action]?.color || 'bg-gray-100 text-gray-700'}`}>
                  {ACTION_LABELS[recs.verdict_action]?.label || recs.verdict_action}
                </span>
              )}
              {recs.engagement_risk && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${RISK_COLORS[recs.engagement_risk] || RISK_COLORS.unknown}`}>
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  Engagement Risk: {recs.engagement_risk}
                </span>
              )}
            </div>

            {recs.rationale && (
              <p className="text-sm text-gray-700 mb-4">{recs.rationale}</p>
            )}

            {recs.suggested_probe_questions && recs.suggested_probe_questions.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Suggested Follow-up Questions for Human Interviewer
                </h4>
                <ol className="space-y-1.5">
                  {recs.suggested_probe_questions.map((q, i) => (
                    <li key={i} className="text-sm text-blue-800 flex gap-2">
                      <span className="text-blue-400 font-medium shrink-0">{i + 1}.</span>
                      {q}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Legacy text recommendations (old reports) */}
        {recsText && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-3">Recommendations</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{recsText}</p>
          </div>
        )}

        {/* Proctor Screenshots */}
        {screenshots.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-blue-500" /> Proctor Screenshots ({screenshots.length})
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {screenshots.map((ss, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden border border-gray-200">
                  <img src={ss.url} alt={`Proctor capture: ${ss.event_type}`} className="w-full h-32 object-cover" loading="lazy" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-2 py-1">
                    <span className="font-medium">{ss.event_type?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Integrity Breakdown */}
        <IntegrityBreakdown breakdown={integrityBreakdown} proctorFlags={report.proctor_flags} />
      </div>
    </>
  )
}
