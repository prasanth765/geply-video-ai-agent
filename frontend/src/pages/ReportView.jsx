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
  strong_yes: { label: 'Strong Yes', tone: 'emerald', icon: CheckCircle },
  yes:        { label: 'Yes',        tone: 'emerald', icon: CheckCircle },
  maybe:      { label: 'Maybe',      tone: 'amber',   icon: MinusCircle },
  no:         { label: 'No',         tone: 'rose',    icon: XCircle },
  strong_no:  { label: 'Strong No',  tone: 'rose',    icon: XCircle },
}

const VERDICT_TONE = {
  emerald: 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 text-emerald-300 border-emerald-500/30',
  amber:   'bg-gradient-to-r from-amber-500/20 to-amber-500/10 text-amber-300 border-amber-500/30',
  rose:    'bg-gradient-to-r from-rose-500/20 to-rose-500/10 text-rose-300 border-rose-500/30',
}

const ACTION_LABELS = {
  advance_to_next_round: { label: 'Advance to Next Round', pill: 'pill-success' },
  human_deep_dive:       { label: 'Human Deep Dive Needed', pill: 'pill-info' },
  re_interview:          { label: 'Re-interview Recommended', pill: 'pill-warning' },
  archive_reject:        { label: 'Archive / Reject', pill: 'pill-danger' },
}

const RISK_PILLS = {
  low:     'pill-success',
  medium:  'pill-warning',
  high:    'pill-danger',
  unknown: 'pill-muted',
}

const SEVERITY_GLASS = {
  green:  'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  yellow: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  red:    'bg-rose-500/10 text-rose-300 border-rose-500/20',
}

/* -- Score Card with optional "Why this score?" evidence -- */
function ScoreCard({ label, value, max = 100, evidence, accent = 'brand' }) {
  const [showEvidence, setShowEvidence] = useState(false)
  const pct = max > 0 ? (value / max) * 100 : 0
  const barGradient =
    value >= 70 ? 'from-emerald-400 to-emerald-500' :
    value >= 50 ? 'from-amber-400 to-amber-500' :
    value >= 25 ? 'from-orange-400 to-orange-500' :
                  'from-rose-400 to-rose-500'

  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-[11px] uppercase tracking-[0.12em] text-tertiary font-medium mb-2">{label}</p>
      <div className="flex items-end gap-1 mb-3">
        <span className="font-display text-[32px] leading-none text-white tabular-nums">{Math.round(value)}</span>
        <span className="text-sm text-tertiary mb-1.5">/{max}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {evidence && (
        <button onClick={() => setShowEvidence(!showEvidence)}
          className="mt-3 flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300 transition-colors">
          <HelpCircle className="h-3 w-3" />
          {showEvidence ? 'Hide evidence' : 'Why this score?'}
        </button>
      )}
      {showEvidence && evidence && (
        <p className="mt-2 text-[11px] text-secondary bg-white/[0.03] border border-white/5 rounded-lg p-2.5 leading-relaxed">{evidence}</p>
      )}
    </div>
  )
}

/* -- Transcript Viewer -- */
function TranscriptViewer({ transcript }) {
  const [expanded, setExpanded] = useState(false)
  if (!transcript || !transcript.trim()) {
    return (
      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="font-display text-lg text-white mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand-400" /> Interview Transcript
        </h2>
        <p className="text-sm text-tertiary italic">No transcript recorded.</p>
      </div>
    )
  }
  const lines = transcript.split('\n').filter(l => l.trim())
  return (
    <div className="glass rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-white flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand-400" /> Interview Transcript
        </h2>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors">
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
              <div className={`max-w-[85%] px-3.5 py-2 rounded-xl text-sm ${
                isInterviewer ? 'bg-white/5 text-secondary border border-white/5' :
                isCandidate ? 'bg-brand-500/15 text-brand-100 border border-brand-500/20' :
                              'bg-white/[0.03] text-tertiary'
              }`}>
                <span className={`text-[10px] font-medium uppercase tracking-wider block mb-0.5 ${
                  isInterviewer ? 'text-tertiary' : isCandidate ? 'text-brand-300' : 'text-tertiary'
                }`}>{isInterviewer ? 'Geply AI' : isCandidate ? 'Candidate' : ''}</span>
                {content}
              </div>
            </div>
          )
        })}
        {!expanded && lines.length > 4 && <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0B0B14] to-transparent pointer-events-none" />}
      </div>
      {!expanded && lines.length > 4 && (
        <button onClick={() => setExpanded(true)} className="mt-3 text-xs text-brand-400 hover:text-brand-300">
          Show full transcript ({lines.length} messages)
        </button>
      )}
    </div>
  )
}

/* -- Enhanced Integrity Breakdown -- */
function IntegrityBreakdown({ breakdown, proctorFlags }) {
  if (!breakdown && (!proctorFlags || proctorFlags.length === 0)) return null

  const deductions = breakdown?.deductions || []
  const severity = breakdown?.severity_summary || {}

  return (
    <div className="glass rounded-2xl p-6 mb-6">
      <h2 className="font-display text-lg text-white mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-brand-400" /> Integrity Analysis
      </h2>

      {breakdown && (
        <div className="mb-4">
          <div className="flex items-center gap-5 mb-4">
            <div className="flex items-end gap-1">
              <span className="font-display text-[40px] leading-none text-white tabular-nums">{breakdown.composite_score}</span>
              <span className="text-sm text-tertiary mb-2">/100</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {severity.green > 0 && <span className="pill pill-success">{severity.green} low</span>}
              {severity.yellow > 0 && <span className="pill pill-warning">{severity.yellow} medium</span>}
              {severity.red > 0 && <span className="pill pill-danger">{severity.red} high</span>}
            </div>
          </div>

          {deductions.length > 0 && (
            <div className="space-y-2">
              {deductions.map((d, i) => (
                <div key={i} className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs border ${SEVERITY_GLASS[d.severity] || 'bg-white/5 text-secondary border-white/5'}`}>
                  <span className="font-medium">{d.event_type?.replace(/_/g, ' ')}</span>
                  <span className="tabular-nums">{d.count}x = -{d.total_penalty} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!breakdown && proctorFlags && proctorFlags.length > 0 && (
        <div className="space-y-2">
          {proctorFlags.map((flag, i) => {
            const flagType = typeof flag === 'string' ? flag : (flag.event_type || flag.type || JSON.stringify(flag))
            const flagTime = typeof flag === 'object' ? (flag.timestamp || '') : ''
            return (
              <div key={i} className="flex items-center gap-2 text-sm text-secondary bg-white/[0.03] border border-white/5 px-3.5 py-2.5 rounded-xl">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="font-medium">{flagType}</span>
                {flagTime && <span className="text-tertiary text-xs ml-auto">{flagTime}</span>}
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

  // Parse qa_by_category if stringified
  let qaByCategory = report.qa_by_category
  if (typeof qaByCategory === 'string') {
    try { qaByCategory = JSON.parse(qaByCategory) } catch { qaByCategory = null }
  }

  const CATEGORY_LABELS = {
    hygiene:          'Hygiene',
    jd_fit:           'JD Questions',
    resume_verify:    'Resume Verify',
    ctc:              'CTC Details',
    recruiter_custom: 'Recruiter Questions',
  }
  const CATEGORY_ORDER = ['hygiene', 'jd_fit', 'resume_verify', 'ctc', 'recruiter_custom']

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

  // Categorized Q&A HTML - show every category that has items
  let categorizedQA = ''
  if (qaByCategory && typeof qaByCategory === 'object') {
    const availableCats = CATEGORY_ORDER.filter(key => Array.isArray(qaByCategory[key]) && qaByCategory[key].length > 0)
    if (availableCats.length > 0) {
      categorizedQA = `<h2>Interview Q&amp;A by category</h2>`
      for (const catKey of availableCats) {
        const items = qaByCategory[catKey]
        const isCtc = catKey === 'ctc'
        const catHtml = items.map((qa, i) => {
          const scoreNum = typeof qa.score === 'number' ? qa.score : null
          const badge = !isCtc && scoreNum !== null && scoreNum > 0
            ? `<span class="qa-score ${scoreNum >= 8 ? 'qa-good' : scoreNum >= 5 ? 'qa-mid' : 'qa-low'}">${scoreNum}/10</span>`
            : ''
          const answerHtml = isCtc
            ? `<div class="ctc-answer">${qa.answer || '-'}</div>`
            : `<p class="qa-ans">A: ${qa.answer || qa.answer_summary || '(no answer recorded)'}</p>`
          return `<div class="qa">
            <div class="qa-head"><span><strong style="color:#7c3aed">Q${i + 1}.</strong> ${qa.question || '(question not captured)'}</span>${badge}</div>
            ${answerHtml}
          </div>`
        }).join('')
        categorizedQA += `<div class="cat-block">
          <h3 class="cat-title">${CATEGORY_LABELS[catKey]} <span class="cat-count">${items.length}</span></h3>
          ${catHtml}
        </div>`
      }
    }
  }

  // Integrity breakdown HTML
  let integrityHtml = ''
  const intBreakdown = breakdown?.integrity_breakdown
  if (intBreakdown) {
    const sev = intBreakdown.severity_summary || {}
    const pills = []
    if (sev.green > 0)  pills.push(`<span class="sev-pill sev-green">${sev.green} low</span>`)
    if (sev.yellow > 0) pills.push(`<span class="sev-pill sev-yellow">${sev.yellow} medium</span>`)
    if (sev.red > 0)    pills.push(`<span class="sev-pill sev-red">${sev.red} high</span>`)
    const deductions = (intBreakdown.deductions || []).map(d => {
      const cls = d.severity === 'red' ? 'sev-red' : d.severity === 'yellow' ? 'sev-yellow' : 'sev-green'
      return `<div class="ded-row ${cls}"><span>${(d.event_type || '').replace(/_/g, ' ')}</span><span>${d.count}x = -${d.total_penalty} pts</span></div>`
    }).join('')
    integrityHtml = `<h2>Integrity analysis</h2>
      <div class="int-card">
        <div class="int-head">
          <div class="int-score">${intBreakdown.composite_score}<small>/100</small></div>
          <div class="int-pills">${pills.join('')}</div>
        </div>
        ${deductions ? `<div class="int-deds">${deductions}</div>` : ''}
      </div>`
  } else if (report.proctor_flags && report.proctor_flags.length > 0) {
    const flagsHtml = report.proctor_flags.map(f => {
      const type = typeof f === 'string' ? f : (f.event_type || f.type || '')
      const ts = typeof f === 'object' ? (f.timestamp || '') : ''
      return `<div class="flag-row"><span>${type.replace(/_/g, ' ')}</span><span class="flag-ts">${ts}</span></div>`
    }).join('')
    integrityHtml = `<h2>Integrity flags</h2><div class="flags-card">${flagsHtml}</div>`
  }

  const transcriptHTML = report.transcript ? report.transcript.split('\n').filter(l => l.trim()).map(line => {
    const isAI = line.trim().startsWith('Interviewer:')
    const content = line.replace(/^(Interviewer|Candidate):\s*/, '').trim()
    return `<div class="msg ${isAI ? 'msg-ai' : 'msg-cand'}"><small>${isAI ? 'Geply AI' : 'Candidate'}</small>${content}</div>`
  }).join('') : '<p class="muted">No transcript recorded.</p>'

  // ---- JD Match Analysis block (pre-interview screening) ----
  // Rendered only when the candidate had a JD match run (all today/future candidates do).
  let jdMatchHtml = ''
  if (report.jd_match_score > 0 || report.jd_match_verdict) {
    let jdBreakdown = null
    try {
      jdBreakdown = report.jd_match_breakdown ? JSON.parse(report.jd_match_breakdown) : null
    } catch (e) {
      jdBreakdown = null
    }
    const jdScore = report.jd_match_score || 0
    const jdVerdict = report.jd_match_verdict || 'no_go'
    const isJdGo = jdVerdict === 'go'
    const jdSubs = jdBreakdown?.sub_scores || {}
    const jdMatched = jdBreakdown?.skills_matched || []
    const jdMissing = jdBreakdown?.skills_missing || []
    const jdDynamic = jdBreakdown?.dynamic_signals || []
    const jdRationale = jdBreakdown?.rationale || ''

    const verdictPillStyle = isJdGo
      ? 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0'
      : 'background:#fef3c7;color:#92400e;border:1px solid #fde68a'
    const verdictLabel = isJdGo ? 'Go' : 'No-Go'

    const subScoresHtml = Object.entries(jdSubs).map(([key, val]) => {
      const num = Number(val) || 0
      const pct = Math.min(100, (num / 5) * 100)
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return `
        <div class="sc">
          <div class="sc-head"><span>${label}</span><span class="sc-val">${num.toFixed(1)}<small>/5</small></span></div>
          <div class="bar"><div class="bar-fill" style="width:${pct}%;background:#a855f7"></div></div>
        </div>`
    }).join('')

    const matchedChips = jdMatched.length > 0 ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:#059669;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;margin-bottom:6px">Skills matched (${jdMatched.length})</div>
        <div class="gap-tags">
          ${jdMatched.map(s => `<span class="gap-tag" style="background:#f0fdf4;color:#166534;border-color:#bbf7d0">${s}</span>`).join('')}
        </div>
      </div>` : ''

    const missingChips = jdMissing.length > 0 ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:#dc2626;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;margin-bottom:6px">Skills missing (${jdMissing.length})</div>
        <div class="gap-tags">
          ${jdMissing.map(s => `<span class="gap-tag">${s}</span>`).join('')}
        </div>
      </div>` : ''

    const dynamicHtml = jdDynamic.length > 0 ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:#6b21a8;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;margin-bottom:6px">Additional signals</div>
        <div style="font-size:13px;color:#374151;line-height:1.6">
          ${jdDynamic.map(sig => {
            const name = typeof sig === 'string' ? sig : (sig.name || sig.label || 'Signal')
            const score = typeof sig === 'object' ? (sig.score ?? '') : ''
            return `<div style="padding:6px 0;border-bottom:1px solid #eef0f5">${name}${score !== '' ? `<span style="float:right;color:#6b21a8;font-weight:600">${Number(score).toFixed(1)}/5</span>` : ''}</div>`
          }).join('')}
        </div>
      </div>` : ''

    const rationaleHtml = jdRationale ? `
      <div class="evidence" style="margin-top:16px;padding:12px 14px;font-size:13px;line-height:1.6">
        <strong style="color:#6b21a8;display:block;margin-bottom:4px">Rationale</strong>
        ${jdRationale}
      </div>` : ''

    jdMatchHtml = `<h2>JD Match Analysis</h2>
      <div class="big-card" style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;gap:16px;flex-wrap:wrap">
          <div>
            <div class="label" style="margin-bottom:4px">Pre-interview screening</div>
            <div style="font-size:11px;color:#8b8fa3">Resume vs Job Description match</div>
          </div>
          <div style="display:flex;align-items:center;gap:14px">
            <div class="num" style="font-size:38px;line-height:1">${jdScore}<small>/100</small></div>
            <div style="padding:6px 16px;border-radius:16px;font-weight:700;font-size:12px;letter-spacing:0.5px;text-transform:uppercase;${verdictPillStyle}">${verdictLabel}</div>
          </div>
        </div>
        ${subScoresHtml}
        ${matchedChips}
        ${missingChips}
        ${dynamicHtml}
        ${rationaleHtml}
      </div>`
  }

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Interview Report - ${verdict}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;color:#1a1a2e;background:#f8f9fc;line-height:1.6}
.wrap{max-width:820px;margin:0 auto;padding:32px 24px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:16px;flex-wrap:wrap}
.header h1{font-family:'Instrument Serif',Georgia,serif;font-size:32px;font-weight:400;color:#1a1a2e;letter-spacing:-0.02em}
.badge{display:inline-block;padding:8px 22px;border-radius:24px;font-weight:700;font-size:13px;color:#fff;background:${vc};letter-spacing:0.8px;text-transform:uppercase;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
.meta{font-size:12px;color:#8b8fa3;margin-bottom:24px}
.verdict-banner{background:linear-gradient(135deg,#faf5ff,#f3e8ff);border:1px solid #e9d5ff;border-radius:12px;padding:16px 20px;margin-bottom:24px;font-weight:500;color:#6b21a8;font-size:14px;line-height:1.6}
.warn-banner{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:24px;color:#92400e;font-size:13px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.big-card{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb}
.big-card .label{font-size:11px;color:#8b8fa3;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px}
.big-card .num{font-family:'Instrument Serif',Georgia,serif;font-size:38px;font-weight:400}
.big-card .num small{font-size:14px;color:#c4c7d4;margin-left:2px}
h2{font-family:'Instrument Serif',Georgia,serif;font-size:22px;font-weight:400;color:#1a1a2e;margin:28px 0 14px;padding-bottom:10px;border-bottom:1px solid #eef0f5}
h2:first-of-type{margin-top:0}
.sc{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e5e7eb;margin-bottom:10px}
.sc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.sc-head span{font-size:13px;font-weight:600;color:#374151}
.sc-val{font-size:18px;font-weight:700;color:#1a1a2e} .sc-val small{font-size:11px;color:#c4c7d4}
.bar{height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden;margin-bottom:6px}
.bar-fill{height:100%;border-radius:3px;transition:width 0.4s}
.evidence{font-size:11px;color:#6b7280;background:#faf5ff;border-radius:6px;padding:8px 10px;margin-top:6px;line-height:1.5;border-left:3px solid #a855f7}
.gap-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:24px}
.gap-tag{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:500}
.summary{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;margin-bottom:24px;font-size:14px;color:#374151;white-space:pre-wrap;line-height:1.7}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.col{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb}
.col h3{font-size:14px;font-weight:700;margin-bottom:10px}
.col li{font-size:13px;margin-bottom:8px;padding-left:4px;list-style:none;display:flex;align-items:flex-start;gap:8px;line-height:1.5}
.s-icon{color:#059669;font-weight:700;flex-shrink:0} .w-icon{color:#dc2626;font-weight:700;flex-shrink:0}
.qa{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e5e7eb;margin-bottom:10px}
.qa-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;font-size:13px;font-weight:600;line-height:1.5}
.qa-score{padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0}
.qa-good{background:#dcfce7;color:#166534} .qa-mid{background:#fef9c3;color:#854d0e} .qa-low{background:#fee2e2;color:#991b1b}
.qa-ans{font-size:13px;color:#4b5563;line-height:1.6;margin-top:4px}
.ctc-answer{display:inline-block;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:500;margin-top:4px}
.cat-block{margin-bottom:20px}
.cat-title{font-size:13px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.cat-count{background:#f3e8ff;color:#7c3aed;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;letter-spacing:0}
.recs{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;margin-bottom:24px}
.recs-tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.recs-tag{padding:5px 14px;border-radius:8px;font-size:12px;font-weight:600}
.action-tag{background:#ede9fe;color:#5b21b6} .risk-low{background:#dcfce7;color:#166534} .risk-med{background:#fef9c3;color:#854d0e} .risk-high{background:#fee2e2;color:#991b1b}
.probe{background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:16px;margin-top:12px}
.probe h4{font-size:12px;font-weight:700;color:#6b21a8;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.8px}
.probe ol{padding-left:20px;font-size:13px;color:#4c1d95;line-height:1.6} .probe li{margin-bottom:6px;padding-left:4px}
.int-card{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;margin-bottom:24px}
.int-head{display:flex;align-items:center;gap:20px;margin-bottom:14px}
.int-score{font-family:'Instrument Serif',Georgia,serif;font-size:42px;font-weight:400;color:#1a1a2e} .int-score small{font-size:14px;color:#c4c7d4}
.int-pills{display:flex;gap:6px;flex-wrap:wrap}
.sev-pill{padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600}
.sev-green{background:#dcfce7;color:#166534} .sev-yellow{background:#fef9c3;color:#854d0e} .sev-red{background:#fee2e2;color:#991b1b}
.int-deds{display:flex;flex-direction:column;gap:6px}
.ded-row{display:flex;justify-content:space-between;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:500;border:1px solid}
.ded-row.sev-green{background:#f0fdf4;border-color:#bbf7d0} .ded-row.sev-yellow{background:#fefce8;border-color:#fde68a} .ded-row.sev-red{background:#fef2f2;border-color:#fecaca}
.flags-card{background:#fff;border-radius:12px;padding:16px;border:1px solid #e5e7eb;margin-bottom:24px;display:flex;flex-direction:column;gap:6px}
.flag-row{display:flex;justify-content:space-between;padding:8px 12px;background:#f9fafb;border-radius:6px;font-size:12px;color:#4b5563}
.flag-ts{color:#9ca3af;font-variant-numeric:tabular-nums}
.transcript{background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;margin-bottom:24px;max-height:500px;overflow-y:auto}
.msg{padding:10px 14px;border-radius:10px;margin-bottom:8px;font-size:13px;line-height:1.5}
.msg small{display:block;font-size:10px;color:#9ca3af;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600}
.msg-ai{background:#f3f4f6;text-align:left} .msg-cand{background:#faf5ff;text-align:right;margin-left:15%;border:1px solid #e9d5ff}
.muted{color:#9ca3af;font-style:italic;font-size:13px}
.footer{text-align:center;font-size:11px;color:#c4c7d4;margin-top:40px;padding-top:20px;border-top:1px solid #eef0f5}
@media print{body{background:#fff} .wrap{padding:16px} .transcript{max-height:none;overflow:visible}}
@media (max-width:640px){.cols{grid-template-columns:1fr}}
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
  <div class="col"><h3 style="color:#059669">Strengths</h3><ul>${(report.strengths || []).map(s => `<li><span class="s-icon">+</span>${typeof s === 'string' ? s : JSON.stringify(s)}</li>`).join('') || '<li class="muted">None demonstrated</li>'}</ul></div>
  <div class="col"><h3 style="color:#dc2626">Areas for improvement</h3><ul>${(report.weaknesses || []).map(w => `<li><span class="w-icon">-</span>${typeof w === 'string' ? w : JSON.stringify(w)}</li>`).join('') || '<li class="muted">None recorded</li>'}</ul></div>
</div>

${categorizedQA}

${qaCards ? `<h2>Key Q&amp;A highlights</h2>${qaCards}` : ''}

${recs ? `<div class="recs"><h2 style="margin-top:0;border:none;padding:0">Recommendations</h2>
<div class="recs-tags">
  ${recs.verdict_action ? `<span class="recs-tag action-tag">${recs.verdict_action.replace(/_/g, ' ')}</span>` : ''}
  ${recs.engagement_risk ? `<span class="recs-tag ${recs.engagement_risk === 'high' ? 'risk-high' : recs.engagement_risk === 'medium' ? 'risk-med' : 'risk-low'}">Engagement risk: ${recs.engagement_risk}</span>` : ''}
</div>
${recs.rationale ? `<p style="font-size:14px;color:#374151;margin-bottom:12px;line-height:1.6">${recs.rationale}</p>` : ''}
${recs.suggested_probe_questions?.length > 0 ? `<div class="probe"><h4>Suggested follow-up questions for human interviewer</h4><ol>${recs.suggested_probe_questions.map(q => `<li>${q}</li>`).join('')}</ol></div>` : ''}
</div>` : ''}

${integrityHtml}

${jdMatchHtml}

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

/* -- Categorized Q&A Section -- */
const CATEGORY_META = {
  hygiene:         { label: 'Hygiene',       icon: ClipboardCheck, accent: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  jd_fit:          { label: 'JD Questions',  icon: Briefcase,      accent: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  resume_verify:   { label: 'Resume Verify', icon: UserCheck,      accent: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  ctc:             { label: 'CTC Details',   icon: DollarSign,     accent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  recruiter_custom:{ label: 'Recruiter Qs',  icon: MessageSquare,  accent: 'bg-brand-500/15 text-brand-300 border-brand-500/30' },
}

function QACategorySection({ qaByCategory }) {
  const availableTabs = Object.keys(CATEGORY_META).filter(key => {
    const items = qaByCategory?.[key]
    return Array.isArray(items) && items.length > 0
  })

  const [activeTab, setActiveTab] = useState(availableTabs[0] || null)

  if (availableTabs.length === 0) return null

  const currentItems = qaByCategory[activeTab] || []

  return (
    <div className="glass rounded-2xl p-6 mb-6">
      <h2 className="font-display text-lg text-white mb-5 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-brand-400" /> Interview Q&amp;A by Category
      </h2>

      <div className="flex flex-wrap gap-2 mb-5 pb-4 border-b border-white/5">
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
                  ? meta.accent
                  : 'bg-white/[0.03] text-tertiary border-white/5 hover:bg-white/[0.06] hover:text-secondary'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
                isActive ? 'bg-white/15' : 'bg-white/5 text-tertiary'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        {currentItems.map((qa, i) => {
          const isCtc = activeTab === 'ctc'
          const scoreNum = typeof qa.score === 'number' ? qa.score : null
          return (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:bg-white/[0.04] transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="text-xs font-semibold text-tertiary shrink-0 mt-0.5 tabular-nums">Q{i + 1}.</span>
                  <p className="text-sm font-medium text-white">{qa.question || '(question not captured)'}</p>
                </div>
                {!isCtc && scoreNum !== null && scoreNum > 0 && (
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                    scoreNum >= 8 ? 'bg-emerald-500/20 text-emerald-300' :
                    scoreNum >= 5 ? 'bg-amber-500/20 text-amber-300' :
                                    'bg-rose-500/20 text-rose-300'
                  }`}>{scoreNum}/10</span>
                )}
              </div>
              <div className="pl-6">
                {isCtc ? (
                  <div className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium ${
                    qa.answer === 'Declined' ? 'bg-white/5 text-tertiary' :
                    qa.answer === 'Not asked' ? 'bg-white/[0.02] text-tertiary italic' :
                                                'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20'
                  }`}>
                    {qa.answer || '-'}
                  </div>
                ) : (
                  <p className="text-sm text-secondary leading-relaxed">
                    <span className="text-tertiary font-medium">A: </span>
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


// ============================================================================
// JD Match Analysis Section (pre-interview screening)
// Rendered at the bottom of the report. Returns null if no JD match data.
// ============================================================================
function JdMatchReportSection({ report }) {
  const score = report.jd_match_score || 0
  const verdict = report.jd_match_verdict || ""
  if (!score && !verdict) return null

  let breakdown = null
  try { breakdown = report.jd_match_breakdown ? JSON.parse(report.jd_match_breakdown) : null }
  catch (e) { breakdown = null }

  const isGo = verdict === 'go'
  const subScores = breakdown?.sub_scores || {}
  const skillsMatched = breakdown?.skills_matched || []
  const skillsMissing = breakdown?.skills_missing || []
  const dynamicSignals = breakdown?.dynamic_signals || []
  const rationale = breakdown?.rationale || ""

  const subScoreEntries = Object.entries(subScores)

  return (
    <div className="glass rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-lg text-white">JD Match Analysis</h2>
          <p className="text-xs text-tertiary mt-1">Pre-interview screening based on resume vs job description</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-3xl font-semibold text-white tabular-nums">{score}</div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isGo ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                 : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}>
            {isGo ? 'Go' : 'No-Go'}
          </div>
        </div>
      </div>

      {subScoreEntries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {subScoreEntries.map(([key, val]) => {
            const num = Number(val) || 0
            const pct = Math.min(100, (num / 5) * 100)
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            return (
              <div key={key} className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-tertiary uppercase tracking-wider mb-1">{label}</div>
                <div className="text-lg font-semibold text-white tabular-nums">
                  {num.toFixed(1)}<span className="text-xs text-tertiary">/5</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-brand-400 rounded-full" style={{width: `${pct}%`}} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(skillsMatched.length > 0 || skillsMissing.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {skillsMatched.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-emerald-300 mb-2 uppercase tracking-wider">Skills Matched</h4>
              <div className="flex flex-wrap gap-1.5">
                {skillsMatched.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-200 border border-emerald-500/20">{s}</span>
                ))}
              </div>
            </div>
          )}
          {skillsMissing.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-amber-300 mb-2 uppercase tracking-wider">Skills Missing</h4>
              <div className="flex flex-wrap gap-1.5">
                {skillsMissing.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/20">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {dynamicSignals.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-brand-300 mb-2 uppercase tracking-wider">Additional Signals</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {dynamicSignals.map((sig, i) => (
              <div key={i} className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-tertiary">{sig.name || sig.label || 'Signal'}</span>
                  <span className="text-sm font-semibold text-white tabular-nums">{sig.score ?? 0}/5</span>
                </div>
                {sig.note && <div className="text-[10px] text-tertiary mt-1">{sig.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {rationale && (
        <div>
          <h4 className="text-xs font-semibold text-secondary mb-2 uppercase tracking-wider">Rationale</h4>
          <p className="text-sm text-secondary leading-relaxed italic">{rationale}</p>
        </div>
      )}
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

  if (loading) return (
    <div className="p-8 max-w-4xl">
      <div className="glass rounded-2xl p-10 text-center text-tertiary">Loading report...</div>
    </div>
  )
  if (!report) return (
    <div className="p-8 max-w-4xl">
      <div className="glass rounded-2xl p-10 text-center text-rose-400">Report not found</div>
    </div>
  )

  const verdictCfg = VERDICT_CONFIG[report.verdict] || VERDICT_CONFIG.maybe
  const VerdictIcon = verdictCfg.icon
  const breakdown = report.score_breakdown || {}
  const isInsufficient = report.summary?.includes('Insufficient interview data')
  const screenshots = report.screenshots || []

  const plainVerdict = breakdown.plain_language_verdict || report.plain_language_verdict || null
  const skillGapsRaw = report.skill_gaps || breakdown.skill_gaps || []
  const skillGaps = typeof skillGapsRaw === 'string' ? (() => { try { return JSON.parse(skillGapsRaw) } catch { return [] } })() : skillGapsRaw
  const integrityBreakdown = breakdown.integrity_breakdown || null

  // Parse qa_by_category if the API returned it as a string
  let qaByCategoryParsed = report.qa_by_category
  if (typeof qaByCategoryParsed === 'string') {
    try { qaByCategoryParsed = JSON.parse(qaByCategoryParsed) } catch { qaByCategoryParsed = null }
  }

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
          #report-printable { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="report-printable" className="p-8 max-w-4xl">
        {/* Hero */}
        <div className="mb-6">
          <p className="text-xs text-brand-400 uppercase tracking-[0.15em] font-medium mb-2 flex items-center gap-1.5">
            <FileText className="h-3 w-3" /> Interview Report
          </p>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="font-display text-[40px] leading-tight tracking-tight text-white">
              Candidate <span className="text-gradient">evaluation</span>
            </h1>
            <div className="flex items-center gap-3 no-print">
              <button onClick={() => downloadReportHTML(report, breakdown, recs, skillGaps, plainVerdict)}
                className="btn-ghost flex items-center gap-1.5 text-sm">
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border backdrop-blur-sm ${VERDICT_TONE[verdictCfg.tone]}`}>
                <VerdictIcon className="h-4 w-4" />
                {verdictCfg.label}
              </div>
            </div>
          </div>
        </div>

        {/* Plain Language Verdict */}
        {plainVerdict && (
          <div className="glass rounded-2xl p-5 mb-6 flex items-start gap-3 border-brand-500/20">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shrink-0 shadow-glow-brand">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-medium text-white leading-relaxed pt-1">{plainVerdict}</p>
          </div>
        )}

        {/* Insufficient banner */}
        {isInsufficient && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-200">Insufficient Interview</p>
              <p className="text-xs text-amber-300/80 mt-0.5">The candidate did not provide enough responses. Review the transcript below.</p>
            </div>
          </div>
        )}

        {/* Primary Scores */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <ScoreCard label="Overall Score" value={report.overall_score} />
          <ScoreCard label="Integrity Score" value={report.integrity_score} />
        </div>

        {/* Score Breakdown */}
        {Object.keys(breakdown).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
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

        {/* Skill Gaps */}
        {skillGaps.length > 0 && (
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="font-display text-lg text-white mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-400" /> Skill Gaps vs Job Description
            </h2>
            <div className="space-y-2">
              {skillGaps.map((gap, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-orange-100 bg-orange-500/10 border border-orange-500/20 px-3.5 py-2.5 rounded-xl">
                  <XCircle className="h-3.5 w-3.5 text-orange-400 mt-0.5 shrink-0" />
                  {gap}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="font-display text-lg text-white mb-3">Summary</h2>
          <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">{report.summary}</p>
        </div>

        {/* Transcript */}
        <TranscriptViewer transcript={report.transcript} />

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="font-display text-lg text-emerald-300 mb-4 flex items-center gap-2">
              <Star className="h-4 w-4" /> Strengths
            </h3>
            <ul className="space-y-2.5">
              {(report.strengths || []).map((s, i) => (
                <li key={i} className="text-sm text-secondary flex items-start gap-2 leading-relaxed">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  {typeof s === 'string' ? s : JSON.stringify(s)}
                </li>
              ))}
              {(!report.strengths || report.strengths.length === 0) && <li className="text-sm text-tertiary italic">No strengths demonstrated</li>}
            </ul>
          </div>
          <div className="glass rounded-2xl p-6">
            <h3 className="font-display text-lg text-rose-300 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Areas for Improvement
            </h3>
            <ul className="space-y-2.5">
              {(report.weaknesses || []).map((w, i) => (
                <li key={i} className="text-sm text-secondary flex items-start gap-2 leading-relaxed">
                  <XCircle className="h-3.5 w-3.5 text-rose-400 mt-0.5 shrink-0" />
                  {typeof w === 'string' ? w : JSON.stringify(w)}
                </li>
              ))}
              {(!report.weaknesses || report.weaknesses.length === 0) && <li className="text-sm text-tertiary italic">No areas recorded</li>}
            </ul>
          </div>
        </div>

        {/* Categorized Q&A */}
        {qaByCategoryParsed && <QACategorySection qaByCategory={qaByCategoryParsed} />}

        {/* Key Q&A */}
        {report.key_qa_pairs && report.key_qa_pairs.length > 0 && (
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="font-display text-lg text-white mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand-400" /> Key Q&A Highlights
            </h2>
            <div className="space-y-3">
              {report.key_qa_pairs.map((qa, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-medium text-white">Q: {qa.question || ''}</p>
                    {qa.score != null && (
                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                        qa.score >= 8 ? 'bg-emerald-500/20 text-emerald-300' :
                        qa.score >= 5 ? 'bg-amber-500/20 text-amber-300' :
                                        'bg-rose-500/20 text-rose-300'
                      }`}>{qa.score}/10</span>
                    )}
                  </div>
                  <p className="text-sm text-secondary leading-relaxed">A: {qa.answer_summary || qa.answer || ''}</p>
                  {qa.evidence_quote && (
                    <p className="mt-2 text-[11px] text-tertiary italic bg-white/[0.03] border-l-2 border-brand-500/40 px-3 py-2 rounded">
                      "{qa.evidence_quote}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recs && (
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="font-display text-lg text-white mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-400" /> Recommendations & Next Steps
            </h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {recs.verdict_action && (
                <span className={`pill ${ACTION_LABELS[recs.verdict_action]?.pill || 'pill-muted'}`}>
                  {ACTION_LABELS[recs.verdict_action]?.label || recs.verdict_action}
                </span>
              )}
              {recs.engagement_risk && (
                <span className={`pill ${RISK_PILLS[recs.engagement_risk] || RISK_PILLS.unknown} flex items-center gap-1`}>
                  <TrendingUp className="h-3 w-3" />
                  Engagement Risk: {recs.engagement_risk}
                </span>
              )}
            </div>

            {recs.rationale && (
              <p className="text-sm text-secondary leading-relaxed mb-4">{recs.rationale}</p>
            )}

            {recs.suggested_probe_questions && recs.suggested_probe_questions.length > 0 && (
              <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-brand-300 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                  <Users className="h-3 w-3" /> Suggested Follow-up Questions
                </h4>
                <ol className="space-y-2">
                  {recs.suggested_probe_questions.map((q, i) => (
                    <li key={i} className="text-sm text-brand-100 flex gap-2 leading-relaxed">
                      <span className="text-brand-400 font-semibold shrink-0 tabular-nums">{i + 1}.</span>
                      {q}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Legacy text recommendations */}
        {recsText && (
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="font-display text-lg text-white mb-3">Recommendations</h2>
            <p className="text-sm text-secondary leading-relaxed">{recsText}</p>
          </div>
        )}

        {/* Proctor Screenshots */}
        {screenshots.length > 0 && (
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="font-display text-lg text-white mb-4 flex items-center gap-2">
              <Camera className="h-4 w-4 text-brand-400" /> Proctor Screenshots ({screenshots.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {screenshots.map((ss, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-white/10">
                  <img src={ss.url} alt={`Proctor capture: ${ss.event_type}`} className="w-full h-32 object-cover" loading="lazy" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent text-white text-[10px] px-2 py-1.5">
                    <span className="font-medium">{ss.event_type?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Integrity Breakdown */}
        <IntegrityBreakdown breakdown={integrityBreakdown} proctorFlags={report.proctor_flags} />

        {/* JD Match Analysis (pre-interview screening) */}
        <JdMatchReportSection report={report} />
      </div>
    </>
  )
}