"""
JD Match Screening Service.

Pre-interview resume-vs-JD screening score. Triggered from resume_worker.py
right after a resume is parsed.

Flow:
  1. Load candidate + job
  2. Build screening prompt (JD + resume + scoring rubric)
  3. Call LLM (same Groq httpx pattern as report_worker.py)
  4. Parse 5 sub-scores (0-5 each)
  5. Apply weighted formula -> final 0-100 score
  6. Derive Go/No-Go verdict (threshold: 70)
  7. Persist to candidates.jd_match_score / _verdict / _breakdown

Scoring formula (user-specified):
  Final = (0.35 * SkillAlignment) + (0.25 * ExperienceRelevance)
        + (0.15 * ProblemSolving) + (0.10 * RoleFit)
        + (0.15 * AvgDynamicScores)
  Each sub-score is 0-5. Multiplier * 20 -> final 0-100.

Verdict: Go if final >= 70, else No-Go.
"""
from __future__ import annotations

import json
from typing import Any

import httpx
import structlog

from app.core.config import get_settings

logger = structlog.get_logger()


# Weights from the product spec
WEIGHTS = {
    "skill_alignment":      0.35,
    "experience_relevance": 0.25,
    "problem_solving":      0.15,
    "role_fit":             0.10,
    "dynamic_avg":          0.15,
}

GO_THRESHOLD = 70  # final score >= this -> "go"


def _build_screening_prompt(
    job_title: str,
    jd_text: str,
    requirements: str,
    resume_text: str,
    candidate_name: str,
) -> str:
    """Build the scoring prompt. Asks LLM for JSON with 5 categories + skills analysis."""

    jd_block = (jd_text or "").strip()[:1500] or "[No JD provided]"
    req_block = (requirements or "").strip()[:500] or "[No explicit requirements]"
    resume_block = (resume_text or "").strip()[:2500] or "[No resume provided]"

    return f"""You are an expert recruitment screening AI. Score this candidate's resume against the specific job.

CANDIDATE: {candidate_name}
ROLE: {job_title}

JOB DESCRIPTION:
{jd_block}

REQUIREMENTS:
{req_block}

CANDIDATE'S RESUME:
{resume_block}

SCORING RUBRIC (each 0-5 integer):

1. skill_alignment (0-5):
   - 5: All mandatory JD skills clearly present with strong resume evidence
   - 4: Most required skills present, minor gaps
   - 3: Partial match, some key skills missing or weak evidence
   - 2: Limited alignment, major JD skills missing
   - 1: Very weak, only 1-2 relevant skills
   - 0: No relevant skills found
   Rules: only count skills EXPLICITLY required in the JD. Ignore extras. Evidence must be visible in resume.

2. experience_relevance (0-5):
   - Years + domain match for the role
   - 5: Perfect years + directly relevant industry/domain
   - 3: Similar domain or similar years, not both
   - 0: No relevant experience

3. problem_solving (0-5):
   - Resume demonstrates analytical/problem-solving capability
   - 5: Quantified outcomes, STAR-format achievements, complex challenges overcome
   - 3: Some achievements listed, few quantified
   - 0: No evidence

4. role_fit (0-5):
   - Overall shape of career trajectory matches this role
   - 5: Career clearly progressing toward this role type
   - 3: Related but not aligned
   - 0: Different career path entirely

5. dynamic_scores (0-5 each, list of 2-3 items):
   - YOU choose 2-3 additional signals from the resume that matter for this specific role.
   - Examples: certifications, leadership, communication clarity, cultural fit signals, geography match, education prestige, language proficiency
   - Pick what's MOST RELEVANT for THIS job. Don't force-fit.
   - Each gets its own 0-5 score.

OUTPUT FORMAT (strict JSON, no markdown, no backticks):
{{
  "skill_alignment":       <0-5 integer>,
  "experience_relevance":  <0-5 integer>,
  "problem_solving":       <0-5 integer>,
  "role_fit":              <0-5 integer>,
  "dynamic_scores": [
    {{ "name": "<short name>", "score": <0-5>, "note": "<1-sentence why>" }},
    {{ "name": "<short name>", "score": <0-5>, "note": "<1-sentence why>" }}
  ],
  "skills_matched": ["<skill from JD that candidate has>", ...],
  "skills_missing": ["<skill from JD that candidate lacks>", ...],
  "rationale": "<2-3 sentence overall summary of the match>"
}}

CRITICAL RULES:
- Every sub-score must be a grounded integer 0-5 based ONLY on resume evidence
- skills_matched / skills_missing: pull specific terms from the JD, not generic
- rationale: objective, no hype, no filler
- OUTPUT ONLY JSON. No explanation before or after. No code fences.
"""


def _call_llm_for_screening(prompt: str) -> dict[str, Any]:
    """Call Groq synchronously with verify=False (matches report_worker.py pattern)."""
    settings = get_settings()

    if not settings.llm_api_key:
        raise RuntimeError("LLM API key not configured")

    payload: dict[str, Any] = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": "You are a precise JSON-output API. Output ONLY valid JSON, nothing else."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 1500,
        "response_format": {"type": "json_object"},
    }

    response = httpx.post(
        f"{settings.llm_base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=45.0,
        verify=False,  # Corporate SSL proxy - matches report_worker pattern
    )
    response.raise_for_status()

    data = response.json()
    content = data["choices"][0]["message"]["content"].strip()

    # Strip code fences if LLM added them
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    return json.loads(content)


def _compute_final_score(parsed: dict[str, Any]) -> tuple[int, dict[str, float]]:
    """Apply the weighted formula. Returns (final_0_to_100, sub_scores_dict)."""

    def safe(val: Any, lo: int = 0, hi: int = 5) -> int:
        try:
            return max(lo, min(hi, int(val)))
        except (TypeError, ValueError):
            return 0

    skill  = safe(parsed.get("skill_alignment"))
    exper  = safe(parsed.get("experience_relevance"))
    probl  = safe(parsed.get("problem_solving"))
    rolef  = safe(parsed.get("role_fit"))

    # Dynamic scores - average whatever LLM returned (list of {name, score, note})
    dyn_list = parsed.get("dynamic_scores") or []
    if isinstance(dyn_list, list) and dyn_list:
        dyn_vals = [safe(item.get("score")) for item in dyn_list if isinstance(item, dict)]
        dyn_avg = sum(dyn_vals) / len(dyn_vals) if dyn_vals else 0.0
    else:
        dyn_avg = 0.0

    sub = {
        "skill_alignment":      skill,
        "experience_relevance": exper,
        "problem_solving":      probl,
        "role_fit":             rolef,
        "dynamic_avg":          round(dyn_avg, 2),
    }

    # Formula: sum(weight * sub_score) * 20 -> 0-100
    weighted = (
        WEIGHTS["skill_alignment"]      * skill +
        WEIGHTS["experience_relevance"] * exper +
        WEIGHTS["problem_solving"]      * probl +
        WEIGHTS["role_fit"]             * rolef +
        WEIGHTS["dynamic_avg"]          * dyn_avg
    )
    final = round(weighted * 20)  # 0-100

    return final, sub


def generate_and_save_screening_sync(candidate_id: str) -> dict[str, Any]:
    """
    Sync function (runs in background thread called from resume_worker).

    Loads candidate + job directly from sync SQLAlchemy engine (same pattern as
    report_worker.generate_report_sync). Safe to call after resume_parsed is set.
    Writes results directly to the candidates table. Never raises on LLM failure -
    returns an error dict and logs; candidate table still gets verdict="error".
    """
    from sqlalchemy import create_engine, text as sql_text

    settings = get_settings()
    sync_url = settings.database_url.replace("+aiosqlite", "")
    engine = create_engine(sync_url)

    try:
        with engine.connect() as conn:
            row = conn.execute(
                sql_text("""
                    SELECT c.id, c.full_name, c.email, c.resume_raw_text,
                           j.title AS job_title, j.jd_raw_text, j.requirements
                    FROM candidates c
                    JOIN jobs j ON c.job_id = j.id
                    WHERE c.id = :id
                """),
                {"id": candidate_id},
            ).fetchone()

            if not row:
                logger.error("screening_candidate_not_found", candidate_id=candidate_id)
                return {"error": "Candidate not found"}

            candidate_name = row.full_name or (row.email.split("@")[0] if row.email else "Candidate")
            resume_text = row.resume_raw_text or ""

            # Guard: skip if resume is too short to meaningfully score
            if len(resume_text.strip()) < 50:
                logger.warning("screening_resume_too_short", candidate_id=candidate_id, length=len(resume_text))
                conn.execute(
                    sql_text("""
                        UPDATE candidates
                        SET jd_match_score = 0,
                            jd_match_verdict = 'no_go',
                            jd_match_breakdown = :breakdown
                        WHERE id = :id
                    """),
                    {
                        "breakdown": json.dumps({"error": "Resume text too short to score"}),
                        "id": candidate_id,
                    },
                )
                conn.commit()
                return {"final_score": 0, "verdict": "no_go", "error": "resume too short"}

            # Build prompt + call LLM
            prompt = _build_screening_prompt(
                job_title=row.job_title or "the role",
                jd_text=row.jd_raw_text or "",
                requirements=row.requirements or "",
                resume_text=resume_text,
                candidate_name=candidate_name,
            )

            try:
                parsed = _call_llm_for_screening(prompt)
            except Exception as exc:
                logger.error("screening_llm_failed", candidate_id=candidate_id, error=str(exc))
                conn.execute(
                    sql_text("""
                        UPDATE candidates
                        SET jd_match_score = 0,
                            jd_match_verdict = 'error',
                            jd_match_breakdown = :breakdown
                        WHERE id = :id
                    """),
                    {
                        "breakdown": json.dumps({"error": f"LLM call failed: {type(exc).__name__}"}),
                        "id": candidate_id,
                    },
                )
                conn.commit()
                return {"error": str(exc)}

            # Compute final score + verdict
            final, sub_scores = _compute_final_score(parsed)
            verdict = "go" if final >= GO_THRESHOLD else "no_go"

            # Build breakdown JSON - stored for frontend display
            breakdown = {
                "final_score":    final,
                "verdict":        verdict,
                "sub_scores":     sub_scores,
                "dynamic_scores": parsed.get("dynamic_scores", []),
                "skills_matched": parsed.get("skills_matched", []),
                "skills_missing": parsed.get("skills_missing", []),
                "rationale":      parsed.get("rationale", ""),
            }

            # Persist
            conn.execute(
                sql_text("""
                    UPDATE candidates
                    SET jd_match_score = :score,
                        jd_match_verdict = :verdict,
                        jd_match_breakdown = :breakdown
                    WHERE id = :id
                """),
                {
                    "score": final,
                    "verdict": verdict,
                    "breakdown": json.dumps(breakdown),
                    "id": candidate_id,
                },
            )
            conn.commit()

            logger.info(
                "screening_complete",
                candidate_id=candidate_id,
                final_score=final,
                verdict=verdict,
                sub_scores=sub_scores,
            )

            return breakdown

    except Exception as exc:
        logger.error("screening_unexpected_error", candidate_id=candidate_id, error=str(exc))
        return {"error": str(exc)}
    finally:
        engine.dispose()
