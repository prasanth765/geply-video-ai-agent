// frontend/src/components/JDMatchDrawer.jsx
//
// Slide-in drawer showing full breakdown of the JD Match screening.
// Opens when recruiter clicks the score pill in the candidates table.
//
// Sections:
//   1. Hero - big score + verdict badge + rationale
//   2. Sub-scores - horizontal bars (each 0-5)
//   3. Dynamic scores - LLM-picked extra signals
//   4. Skills matched / missing - two columns
//
// No API call - reads everything from the candidate's stored jd_match_breakdown JSON.

import { X, TrendingUp, TrendingDown, Info } from 'lucide-react'

const SUB_LABELS = {
  skill_alignment:      'Skill Alignment',
  experience_relevance: 'Experience Relevance',
  problem_solving:      'Problem-Solving',
  role_fit:             'Role Fit',
  dynamic_avg:          'Dynamic Signals (avg)',
}

const WEIGHTS = {
  skill_alignment:      0.35,
  experience_relevance: 0.25,
  problem_solving:      0.15,
  role_fit:             0.10,
  dynamic_avg:          0.15,
}

function Bar({ value, max = 5 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const hue = value >= 4 ? 'bg-success' : value >= 3 ? 'bg-brand-500' : value >= 2 ? 'bg-warning' : 'bg-danger'
  return (
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full ${hue} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function JDMatchDrawer({ candidate, onClose }) {
  let breakdown = null
  try {
    breakdown = candidate.jd_match_breakdown
      ? JSON.parse(candidate.jd_match_breakdown)
      : null
  } catch {
    breakdown = null
  }

  const score = candidate.jd_match_score || 0
  const verdict = candidate.jd_match_verdict || ''
  const isGo = verdict === 'go'
  const isError = verdict === 'error'

  const subScores = breakdown?.sub_scores || {}
  const dynamicScores = breakdown?.dynamic_scores || []
  const skillsMatched = breakdown?.skills_matched || []
  const skillsMissing = breakdown?.skills_missing || []
  const rationale = breakdown?.rationale || ''

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-[#0b0614]/95 backdrop-blur-xl border-l border-white/10 shadow-[-8px_0_40px_rgba(0,0,0,0.5)] flex flex-col"
        role="dialog"
        aria-label="JD Match breakdown"
      >
        {/* Header */}
        <header className="px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-brand-300 uppercase tracking-wider mb-1">
                JD Match Breakdown
              </p>
              <h2 className="font-serif text-2xl text-white truncate">
                {candidate.full_name || candidate.email || 'Candidate'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Error state */}
          {isError && (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
              <p className="text-sm text-danger font-medium mb-1">Scoring failed</p>
              <p className="text-xs text-gray-400">
                {breakdown?.error || 'The LLM could not score this candidate. Try re-uploading or contact support.'}
              </p>
            </div>
          )}

          {/* Hero card */}
          {!isError && (
            <div className={`rounded-xl p-5 border ${isGo ? 'border-success/30 bg-gradient-to-br from-success/10 to-success/[0.02]' : 'border-warning/30 bg-gradient-to-br from-warning/10 to-warning/[0.02]'}`}>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-serif text-5xl ${isGo ? 'text-success' : 'text-warning'}`}>
                      {score}
                    </span>
                    <span className="text-xl text-gray-400 font-serif">/ 100</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {isGo ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-warning" />
                    )}
                    <span className={`text-sm font-medium uppercase tracking-wider ${isGo ? 'text-success' : 'text-warning'}`}>
                      {isGo ? 'Recommended to invite' : 'Not a strong match'}
                    </span>
                  </div>
                </div>
              </div>

              {rationale && (
                <p className="text-sm text-gray-300 mt-4 leading-relaxed">
                  {rationale}
                </p>
              )}
            </div>
          )}

          {/* Sub-scores */}
          {!isError && Object.keys(subScores).length > 0 && (
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="font-serif text-base text-white mb-4 flex items-center gap-2">
                Core scores
                <span className="text-xs text-gray-500 font-sans">(each 0-5)</span>
              </h3>
              <div className="space-y-3">
                {Object.entries(SUB_LABELS).map(([key, label]) => {
                  const value = subScores[key] ?? 0
                  const weight = WEIGHTS[key]
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-200">{label}</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            weight {Math.round(weight * 100)}%
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-white tabular-nums">
                          {Number(value).toFixed(value % 1 === 0 ? 0 : 1)} / 5
                        </span>
                      </div>
                      <Bar value={value} />
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Dynamic scores */}
          {!isError && dynamicScores.length > 0 && (
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="font-serif text-base text-white mb-3 flex items-center gap-2">
                Additional signals
                <span className="text-xs text-gray-500 font-sans">(AI-picked for this role)</span>
              </h3>
              <div className="space-y-2.5">
                {dynamicScores.map((d, i) => (
                  <div key={i} className="rounded-lg bg-black/30 border border-white/5 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{d.name || 'Signal'}</span>
                      <span className="text-xs font-mono text-brand-300 tabular-nums">
                        {d.score ?? 0} / 5
                      </span>
                    </div>
                    {d.note && (
                      <p className="text-xs text-gray-400 leading-relaxed">{d.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Skills comparison */}
          {!isError && (skillsMatched.length > 0 || skillsMissing.length > 0) && (
            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-success/20 bg-success/5 p-4">
                <h4 className="text-xs font-medium text-success uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span>Matched</span>
                  <span className="px-1.5 py-0.5 rounded bg-success/15 text-[10px]">
                    {skillsMatched.length}
                  </span>
                </h4>
                {skillsMatched.length > 0 ? (
                  <ul className="space-y-1.5">
                    {skillsMatched.map((s, i) => (
                      <li key={i} className="text-xs text-gray-200 flex items-start gap-1.5">
                        <span className="text-success shrink-0 mt-0.5">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500 italic">None detected</p>
                )}
              </div>

              <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
                <h4 className="text-xs font-medium text-warning uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span>Missing</span>
                  <span className="px-1.5 py-0.5 rounded bg-warning/15 text-[10px]">
                    {skillsMissing.length}
                  </span>
                </h4>
                {skillsMissing.length > 0 ? (
                  <ul className="space-y-1.5">
                    {skillsMissing.map((s, i) => (
                      <li key={i} className="text-xs text-gray-200 flex items-start gap-1.5">
                        <span className="text-warning shrink-0 mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500 italic">No gaps</p>
                )}
              </div>
            </section>
          )}

          {/* Info footer */}
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <p className="text-[11px] text-gray-500 flex items-start gap-2 leading-relaxed">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                AI-generated screening based on resume vs JD match. Scores update automatically when
                a new resume is uploaded. Threshold for "Go": 70 / 100.
              </span>
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
