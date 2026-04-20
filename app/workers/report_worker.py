from __future__ import annotations

import json
import uuid
from pathlib import Path

import httpx
import structlog

from app.core.config import get_settings
from app.core.constants import COMPANY_NAME
from app.utils.notify import create_notification_sync

logger = structlog.get_logger()


def generate_report_sync(interview_id: str) -> dict:
    """Generate a full interview report after interview completion.

    Runs in a background thread (sync) because the async session is
    already committed before this is called.
    """
    from sqlalchemy import create_engine, text as sql_text

    settings = get_settings()
    sync_url = settings.database_url.replace("+aiosqlite", "")
    engine = create_engine(sync_url)

    try:
        with engine.connect() as conn:
            row = conn.execute(
                sql_text("""
                    SELECT i.id, i.transcript, i.questions_asked, i.answers_received,
                           i.proctor_events, i.proctor_score,
                           i.recording_path, i.candidate_id, i.job_id,
                           c.full_name AS candidate_name, c.email AS candidate_email,
                           c.resume_raw_text,
                           j.title AS job_title, j.jd_raw_text, j.requirements,
                           j.recruiter_id
                    FROM interviews i
                    JOIN candidates c ON i.candidate_id = c.id
                    JOIN jobs j ON i.job_id = j.id
                    WHERE i.id = :id
                """),
                {"id": interview_id},
            ).fetchone()

            if not row:
                logger.error("interview_not_found", interview_id=interview_id)
                return {"error": "Interview not found"}

            transcript = row.transcript or ""
            exchange_count = _count_exchanges(transcript)
            candidate_words = _count_candidate_words(transcript)

            logger.info(
                "transcript_analysis",
                interview_id=interview_id,
                transcript_length=len(transcript),
                exchanges=exchange_count,
                candidate_words=candidate_words,
            )

            proctor_events = _safe_json_load(row.proctor_events)
            proctor_score = row.proctor_score if row.proctor_score is not None else 100.0

            # Enhanced integrity breakdown
            integrity_breakdown = _build_integrity_breakdown(proctor_events, proctor_score)

            # Fetch CTC + recruiter_questions flags for this job (separate small query)
            job_flags_row = conn.execute(
                sql_text("SELECT ask_ctc, recruiter_questions FROM jobs WHERE id = :id"),
                {"id": row.job_id},
            ).fetchone()
            ask_ctc = bool(job_flags_row.ask_ctc) if job_flags_row else False
            recruiter_qs_raw = job_flags_row.recruiter_questions if job_flags_row else None
            recruiter_questions = _safe_json_load(recruiter_qs_raw) if recruiter_qs_raw else []

            analysis = _call_llm_for_analysis(
                transcript=transcript,
                jd_text=row.jd_raw_text or "",
                requirements=row.requirements or "",
                job_title=row.job_title or "",
                candidate_name=row.candidate_name or "",
                resume_text=row.resume_raw_text or "",
                exchange_count=exchange_count,
                candidate_words=candidate_words,
                ask_ctc=ask_ctc,
                recruiter_questions=recruiter_questions,
            )

            overall_score = _clamp(analysis.get("overall_score", 0), 0, 100)
            score_breakdown = analysis.get("score_breakdown", {})

            if overall_score == 0 and score_breakdown:
                vals = [v for v in score_breakdown.values()
                        if isinstance(v, (int, float)) and not isinstance(v, dict)]
                if vals:
                    overall_score = round(sum(vals) / len(vals), 1)

            verdict = _derive_verdict(overall_score)
            screenshot_urls = _discover_screenshots(interview_id)

            report_id = str(uuid.uuid4())

            # Merge integrity breakdown into score_breakdown for storage
            score_breakdown["integrity_breakdown"] = integrity_breakdown

            conn.execute(
                sql_text("""
                    INSERT INTO reports (
                        id, interview_id, candidate_id, job_id,
                        overall_score, verdict, score_breakdown,
                        summary, strengths, weaknesses,
                        key_qa_pairs, qa_by_category, recommendations,
                        integrity_score, proctor_flags, screenshots,
                        recording_url, highlight_reel_url, pdf_report_path,
                        sent_to_recruiter,
                        created_at, updated_at
                    ) VALUES (
                        :id, :interview_id, :candidate_id, :job_id,
                        :overall_score, :verdict, :score_breakdown,
                        :summary, :strengths, :weaknesses,
                        :key_qa_pairs, :qa_by_category, :recommendations,
                        :integrity_score, :proctor_flags, :screenshots,
                        :recording_url, '', '',
                        0,
                        datetime('now'), datetime('now')
                    )
                """),
                {
                    "id": report_id,
                    "interview_id": interview_id,
                    "candidate_id": row.candidate_id,
                    "job_id": row.job_id,
                    "overall_score": overall_score,
                    "verdict": verdict,
                    "score_breakdown": json.dumps(score_breakdown),
                    "summary": analysis.get("summary", ""),
                    "strengths": json.dumps(analysis.get("strengths", [])),
                    "weaknesses": json.dumps(analysis.get("weaknesses", [])),
                    "key_qa_pairs": json.dumps(analysis.get("key_qa_pairs", [])),
                    "recommendations": json.dumps(analysis.get("recommendations", {})),
                    "integrity_score": proctor_score,
                    "proctor_flags": json.dumps(proctor_events),
                    "screenshots": json.dumps(screenshot_urls),
                    "recording_url": row.recording_path or "",
                },
            )

            conn.execute(
                sql_text("""
                    UPDATE interviews
                    SET overall_score = :overall,
                        technical_score = :technical,
                        communication_score = :communication,
                        problem_solving_score = :problem_solving
                    WHERE id = :id
                """),
                {
                    "id": interview_id,
                    "overall": overall_score,
                    "technical": _clamp(score_breakdown.get("technical", 0), 0, 100),
                    "communication": _clamp(score_breakdown.get("communication", 0), 0, 100),
                    "problem_solving": _clamp(score_breakdown.get("problem_solving", 0), 0, 100),
                },
            )

            conn.execute(
                sql_text("UPDATE candidates SET status = 'report_ready' WHERE id = :id"),
                {"id": row.candidate_id},
            )
            conn.commit()

        # Notify recruiter
        if row.recruiter_id:
            try:
                create_notification_sync(
                    recruiter_id=row.recruiter_id,
                    type="report_ready",
                    title=f"Report ready: {row.candidate_name}",
                    message=f"{row.candidate_name} scored {overall_score}% ({verdict}) for {row.job_title}",
                    metadata={
                        "report_id": report_id,
                        "job_id": row.job_id,
                        "candidate_name": row.candidate_name,
                    },
                )
            except Exception as ne:
                logger.warning("report_notification_failed", error=str(ne))

        logger.info(
            "report_generated",
            interview_id=interview_id,
            report_id=report_id,
            verdict=verdict,
            overall_score=overall_score,
            exchanges=exchange_count,
        )
        return {"report_id": report_id, "verdict": verdict}

    except Exception as exc:
        logger.error("report_generation_failed", interview_id=interview_id, error=str(exc))
        return {"error": str(exc)}
    finally:
        engine.dispose()


# ---------------------------------------------------------------------------
# Enhanced LLM Analysis Prompt (2026 standards)
# ---------------------------------------------------------------------------

def _call_llm_for_analysis(
    transcript: str,
    jd_text: str,
    requirements: str,
    job_title: str,
    candidate_name: str = "",
    resume_text: str = "",
    exchange_count: int = 0,
    candidate_words: int = 0,
    ask_ctc: bool = False,
    recruiter_questions: list | None = None,
) -> dict:
    settings = get_settings()

    if not settings.llm_api_key:
        return _fallback_analysis("LLM API key not configured")

    if not transcript.strip():
        return _insufficient_interview("No transcript recorded. Candidate may have left immediately.")

    if exchange_count == 0 or candidate_words < 3:
        return _insufficient_interview(
            f"Candidate provided only {candidate_words} words across {exchange_count} exchange(s). "
            "No meaningful evaluation is possible."
        )

    prompt = f"""You are a strict, evidence-based interview evaluator for {COMPANY_NAME}. Analyze ONLY what the candidate ACTUALLY SAID in the transcript below.

CRITICAL RULES:
1. Score ONLY based on what the candidate said in the interview, NOT their resume
2. Short, vague, or non-answers = LOW scores (5-20 range)
3. Substantive answers with examples = score accordingly (40-90 range)
4. NEVER fabricate Q&A pairs that did not happen in the transcript
5. Every score MUST have an evidence field quoting what the candidate said (or noting silence)
6. key_qa_pairs must contain ONLY questions from the transcript

Role: {job_title}
Candidate: {candidate_name}
Interview exchanges: {exchange_count}
Candidate total words: {candidate_words}

=== JOB DESCRIPTION ===
{jd_text[:1500]}

=== REQUIREMENTS ===
{requirements[:800]}

=== CANDIDATE RESUME (context only, do NOT score based on this) ===
{resume_text[:1000]}

=== INTERVIEW TRANSCRIPT (score ONLY based on this) ===
{transcript[:5000]}

Return a JSON object with EXACTLY these fields:

{{
  "overall_score": <number 0-100>,

  "plain_language_verdict": "<1 sentence: e.g. 'Strong candidate with deep sourcing expertise' or 'Candidate showed minimal engagement and is not recommended'>",

  "score_breakdown": {{
    "technical": <0-100>,
    "technical_evidence": "<quote or paraphrase what candidate said that justifies this score>",
    "communication": <0-100>,
    "communication_evidence": "<evidence>",
    "problem_solving": <0-100>,
    "problem_solving_evidence": "<evidence>",
    "domain_knowledge": <0-100>,
    "domain_knowledge_evidence": "<evidence>",
    "cultural_fit": <0-100>,
    "cultural_fit_evidence": "<evidence>"
  }},

  "skill_gaps": [
    "<specific skill from JD that candidate did NOT demonstrate, e.g. 'No mention of Boolean search or sourcing tools'>",
    "<another gap>"
  ],

  "summary": "<2-3 paragraph assessment of what happened in the interview>",

  "strengths": ["<strength demonstrated IN THE INTERVIEW>"],
  "weaknesses": ["<weakness observed IN THE INTERVIEW>"],

  "key_qa_pairs": [
    {{
      "question": "<exact question from transcript>",
      "answer_summary": "<what candidate actually said>",
      "score": <1-10>,
      "evidence_quote": "<direct quote from transcript, max 30 words>"
    }}
  ],

  "recommendations": {{
    "verdict_action": "<one of: advance_to_next_round | human_deep_dive | re_interview | archive_reject>",
    "rationale": "<1-2 sentences explaining why>",
    "suggested_probe_questions": ["<if advancing: 3 targeted follow-up questions for human interviewer>"],
    "engagement_risk": "<low | medium | high - likelihood of dropout if hired, based on interview engagement>"
  }},

  "qa_by_category": {{
    "hygiene": [
      {{"question": "<exact question from transcript>", "answer": "<candidate's answer, verbatim or summarized>", "score": <1-10>}}
    ],
    "jd_fit": [
      {{"question": "<exact question>", "answer": "<answer>", "score": <1-10>}}
    ],
    "resume_verify": [
      {{"question": "<exact question>", "answer": "<answer>", "score": <1-10>}}
    ],
    "ctc": [
      {{"question": "<exact question>", "answer": "<exact value mentioned, or 'Declined' if refused, or 'Not asked' if CTC block was skipped>", "score": 0}}
    ],
    "recruiter_custom": [
      {{"question": "<exact question>", "answer": "<answer>", "score": <1-10>}}
    ]
  }}
}}

CATEGORIZATION INSTRUCTIONS:
- Go through the transcript and place EVERY interviewer question into exactly ONE of the 5 categories above.
- "hygiene" = Q1 (relocation) + Q2 (shift). Usually exactly 2 questions.
- "jd_fit" = questions about job-related skills/experience from the JD. Usually 4-6 questions.
- "resume_verify" = questions asking about specific resume items. Usually 2 questions.
- "ctc" = questions specifically about current or expected CTC/salary. Only present if CTC was asked.
- "recruiter_custom" = questions the recruiter explicitly provided (listed below if any).
- If the candidate refused to answer CTC, record answer as "Declined" with score 0.
- If a category has no questions (e.g. CTC was not asked), return an empty array [].
- Score each Q&A pair 1-10 based on answer quality. For CTC, use 0 (not a skill score).

CONTEXT FOR CATEGORIZATION:
- CTC questions were {"ASKED" if ask_ctc else "NOT ASKED"} in this interview.
- Recruiter-provided custom questions to look for: {recruiter_questions if recruiter_questions else "None"}

Scoring guide:
- 80-100: Exceptional - detailed, specific answers with examples
- 65-79: Good - solid answers showing competence
- 50-64: Average - some substance but lacking depth
- 25-49: Below average - vague or incomplete answers
- 0-24: Poor - non-answers, single words, or disengaged

If the candidate barely participated, scores should be 5-15. Do NOT inflate.

Return ONLY valid JSON."""

    try:
        response = httpx.post(
            f"{settings.llm_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.llm_model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 2500,
                "temperature": 0.2,
            },
            timeout=60.0,
            verify=False,  # Corporate SSL proxy
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]

        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
        if content.endswith("```"):
            content = content.rsplit("```", 1)[0]
        content = content.strip()

        parsed = json.loads(content)
        logger.info("llm_analysis_complete", score=parsed.get("overall_score"))
        return parsed

    except json.JSONDecodeError as exc:
        logger.error("llm_json_parse_failed", error=str(exc))
        return _fallback_analysis(f"LLM returned invalid JSON: {exc}")
    except httpx.HTTPStatusError as exc:
        logger.error("llm_http_error", status=exc.response.status_code)
        return _fallback_analysis(f"LLM API error: {exc.response.status_code}")
    except Exception as exc:
        logger.error("llm_analysis_failed", error=str(exc))
        return _fallback_analysis(str(exc))


# ---------------------------------------------------------------------------
# Integrity Breakdown Builder
# ---------------------------------------------------------------------------

def _build_integrity_breakdown(proctor_events: list, proctor_score: float) -> dict:
    """Build a detailed integrity breakdown from proctor events.

    Returns a dict with:
      - composite_score: the final integrity score
      - base_score: starting score (100)
      - deductions: list of {event_type, count, penalty_each, total_penalty}
      - severity_summary: {green: count, yellow: count, red: count}
    """
    from collections import Counter
    from app.core.constants import ProctorEventType

    severity_map = {
        ProctorEventType.TAB_SWITCH: "yellow",
        ProctorEventType.COPY_PASTE: "yellow",
        ProctorEventType.RIGHT_CLICK: "green",
        ProctorEventType.DEVTOOLS_OPEN: "red",
        ProctorEventType.VIEW_SOURCE: "red",
        ProctorEventType.WINDOW_BLUR: "yellow",
        ProctorEventType.FULLSCREEN_EXIT: "yellow",
        ProctorEventType.WINDOW_RESIZE: "green",
        ProctorEventType.FACE_NOT_DETECTED: "red",
        ProctorEventType.MULTIPLE_FACES: "red",
        ProctorEventType.AUDIO_ANOMALY: "yellow",
    }

    penalty_map = {
        ProctorEventType.TAB_SWITCH: 5.0,
        ProctorEventType.COPY_PASTE: 3.0,
        ProctorEventType.RIGHT_CLICK: 2.0,
        ProctorEventType.DEVTOOLS_OPEN: 10.0,
        ProctorEventType.VIEW_SOURCE: 8.0,
        ProctorEventType.WINDOW_BLUR: 3.0,
        ProctorEventType.FULLSCREEN_EXIT: 4.0,
        ProctorEventType.WINDOW_RESIZE: 2.0,
        ProctorEventType.FACE_NOT_DETECTED: 10.0,
        ProctorEventType.MULTIPLE_FACES: 15.0,
        ProctorEventType.AUDIO_ANOMALY: 5.0,
    }

    event_types = [e.get("type", "unknown") for e in proctor_events]
    counts = Counter(event_types)

    deductions = []
    severity_counts = {"green": 0, "yellow": 0, "red": 0}

    for event_type, count in counts.items():
        penalty_each = penalty_map.get(event_type, 1.0)
        severity = severity_map.get(event_type, "yellow")
        severity_counts[severity] += count
        deductions.append({
            "event_type": event_type,
            "count": count,
            "penalty_each": penalty_each,
            "total_penalty": round(penalty_each * count, 1),
            "severity": severity,
        })

    return {
        "composite_score": round(proctor_score, 1),
        "base_score": 100,
        "total_events": len(proctor_events),
        "deductions": sorted(deductions, key=lambda d: d["total_penalty"], reverse=True),
        "severity_summary": severity_counts,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _insufficient_interview(reason: str) -> dict:
    return {
        "overall_score": 5,
        "plain_language_verdict": "Candidate did not engage meaningfully and cannot be evaluated.",
        "score_breakdown": {
            "technical": 0, "technical_evidence": "No technical responses given.",
            "communication": 5, "communication_evidence": "Minimal or no verbal engagement.",
            "problem_solving": 0, "problem_solving_evidence": "No problem-solving demonstrated.",
            "domain_knowledge": 0, "domain_knowledge_evidence": "No domain knowledge shared.",
            "cultural_fit": 5, "cultural_fit_evidence": "Showed up but did not participate.",
        },
        "skill_gaps": ["Unable to assess - candidate did not engage"],
        "summary": f"Insufficient interview data. {reason}\n\nThe candidate did not engage meaningfully with the interviewer.",
        "strengths": [],
        "weaknesses": ["Did not engage with interview questions", "No substantive responses provided"],
        "key_qa_pairs": [],
        "recommendations": {
            "verdict_action": "archive_reject",
            "rationale": reason,
            "suggested_probe_questions": [],
            "engagement_risk": "high",
        },
    }


def _fallback_analysis(reason: str) -> dict:
    return {
        "overall_score": 0,
        "plain_language_verdict": "Automated analysis unavailable. Manual review required.",
        "score_breakdown": {},
        "skill_gaps": [],
        "summary": f"Automated analysis unavailable: {reason}. Please review the transcript manually.",
        "strengths": [],
        "weaknesses": [],
        "key_qa_pairs": [],
        "recommendations": {
            "verdict_action": "human_deep_dive",
            "rationale": "Manual review required due to analysis failure.",
            "suggested_probe_questions": [],
            "engagement_risk": "unknown",
        },
    }


def _derive_verdict(score: float) -> str:
    if score >= 80:
        return "strong_yes"
    if score >= 65:
        return "yes"
    if score >= 50:
        return "maybe"
    if score >= 30:
        return "no"
    return "strong_no"


def _clamp(value, min_val: float, max_val: float) -> float:
    try:
        return max(min_val, min(float(value), max_val))
    except (TypeError, ValueError):
        return min_val


def _safe_json_load(val) -> list:
    if val is None:
        return []
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return []
    return []


def _count_exchanges(transcript: str) -> int:
    if not transcript:
        return 0
    return sum(1 for line in transcript.split("\n") if line.strip().startswith("Candidate:"))


def _count_candidate_words(transcript: str) -> int:
    if not transcript:
        return 0
    total = 0
    for line in transcript.split("\n"):
        s = line.strip()
        if s.startswith("Candidate:"):
            total += len(s.replace("Candidate:", "", 1).strip().split())
    return total


def _discover_screenshots(interview_id: str) -> list[dict]:
    settings = get_settings()
    screenshot_dir = Path(settings.storage_local_path) / "screenshots" / interview_id
    if not screenshot_dir.exists():
        return []
    screenshots = []
    for fp in sorted(screenshot_dir.iterdir()):
        if fp.suffix.lower() in (".jpg", ".jpeg", ".png"):
            parts = fp.stem.split("_", 1)
            event_type = parts[1] if len(parts) > 1 else "unknown"
            screenshots.append({
                "url": f"/api/v1/internal/screenshot/{interview_id}/{fp.name}",
                "event_type": event_type,
                "filename": fp.name,
            })
    logger.info("screenshots_discovered", interview_id=interview_id, count=len(screenshots))
    return screenshots
