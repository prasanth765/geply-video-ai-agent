// frontend/src/components/JDMatchCell.jsx
//
// Compact cell renderer for the JD Match column in the candidates table.
// Shows: score (large) + Go/No-Go pill. Clickable to open breakdown drawer.
//
// States:
//   - Not scored yet (score=0, verdict=''): dash placeholder
//   - In progress (score=0, verdict=''): "Scoring..." with pulse (future use)
//   - Scored: number + pill
//   - Error (verdict='error'): retry icon

import { AlertCircle } from 'lucide-react'

export default function JDMatchCell({ candidate, onOpen }) {
  const score = candidate.jd_match_score || 0
  const verdict = candidate.jd_match_verdict || ''

  // Not yet scored
  if (!verdict) {
    return <span className="text-tertiary text-xs">-</span>
  }

  // Scoring errored
  if (verdict === 'error') {
    return (
      <button
        onClick={() => onOpen(candidate)}
        title="Scoring failed - click for details"
        className="inline-flex items-center gap-1 text-xs text-danger hover:text-danger/80"
      >
        <AlertCircle className="h-3.5 w-3.5" />
        Error
      </button>
    )
  }

  const isGo = verdict === 'go'

  return (
    <button
      onClick={() => onOpen(candidate)}
      title="Click for breakdown"
      className="inline-flex items-center gap-2 group hover:opacity-80 transition-opacity"
    >
      <span className={`text-sm font-semibold tabular-nums ${isGo ? 'text-success' : 'text-warning'}`}>
        {score}
      </span>
      <span
        className={`pill text-[10px] ${
          isGo
            ? 'bg-success/15 text-success border border-success/30'
            : 'bg-warning/15 text-warning border border-warning/30'
        }`}
      >
        {isGo ? 'Go' : 'No-Go'}
      </span>
    </button>
  )
}
