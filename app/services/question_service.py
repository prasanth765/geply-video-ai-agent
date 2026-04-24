"""
Candidate-specific interview question generator.

Given a candidate (with parsed resume) and a job (with JD + requirements +
recruiter custom questions + CTC flag), this service:

1. Calls Groq LLM ONCE with a specialized prompt.
2. Parses structured JSON response (5 categories, question per category).
3. Persists to candidate_interview_questions table (deletes any existing rows first).

Safe to call multiple times - behaves as an idempotent regenerate.
"""
from __future__ import annotations

import json
from typing import Any

import httpx
import structlog
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import COMPANY_NAME
from app.core.exceptions import LLMServiceError
from app.models.candidate import Candidate
from app.models.interview_question import InterviewQuestion
from app.models.job import Job

logger = structlog.get_logger()


# Valid category keys - single source of truth
CATEGORIES = ("hygiene", "jd_fit", "resume_verify", "ctc", "recruiter_custom")

# How many questions per category we ask the LLM to produce
QUESTION_COUNTS = {
    "hygiene":          2,  # relocation + shift
    "jd_fit":           6,  # core of the screening
    "resume_verify":    2,  # verify candidate claims
    "ctc":              2,  # only if ask_ctc=True
    "recruiter_custom": 0,  # pre-filled from recruiter input, not LLM
}


def _build_extraction_prompt(
    job_title: str,
    jd_text: str,
    requirements: str,
    resume_text: str,
    candidate_name: str,
    office_locations: str,
    shift_info: str,
    ask_ctc: bool,
    recruiter_questions: list[str],
) -> str:
    """Build the system prompt that asks Groq to produce 5-category questions as JSON."""

    first_name = candidate_name.split()[0] if candidate_name else "the candidate"
    locations = office_locations.replace(",", ", ") if office_locations else "our India offices"

    jd_block = (jd_text or "").strip()[:1200] or "[No JD provided]"
    req_block = (requirements or "").strip()[:400] or "[No explicit requirements]"
    resume_block = (resume_text or "").strip()[:1500] or "[No resume provided]"

    ctc_instruction = (
        'Include 2 CTC questions: current CTC and expected CTC.'
        if ask_ctc
        else 'Return an empty list for "ctc" - the recruiter chose not to ask CTC.'
    )

    if recruiter_questions:
        rq_list = "\n".join(f"  - {q}" for q in recruiter_questions if q and q.strip())
        recruiter_instruction = (
            f'Include these recruiter-provided questions verbatim in "recruiter_custom":\n{rq_list}'
        )
    else:
        recruiter_instruction = 'Return an empty list for "recruiter_custom" - no recruiter questions provided.'

    return f"""You are an expert interview question designer for {COMPANY_NAME}'s AI interview platform.

Generate a tailored set of interview questions for this specific candidate applying to this specific job.

CANDIDATE: {candidate_name}
ROLE: {job_title}

JD:
{jd_block}

REQUIREMENTS:
{req_block}

CANDIDATE'S RESUME:
{resume_block}

OFFICE LOCATIONS: {locations}
SHIFT: {shift_info or "standard hours"}

OUTPUT FORMAT (respond with VALID JSON ONLY, no markdown, no backticks, no prose):
{{
  "hygiene":          ["question 1", "question 2"],
  "jd_fit":           ["question 1", "question 2", "question 3", "question 4", "question 5", "question 6"],
  "resume_verify":    ["question 1", "question 2"],
  "ctc":              [],
  "recruiter_custom": []
}}

RULES BY CATEGORY:

HYGIENE (exactly 2 questions):
1. Relocation to one of the office locations: {locations}
2. Comfort with shift: {shift_info or "standard hours"}

JD_FIT (exactly 6 questions):
Questions that test whether this candidate is worthy of the {job_title} role:
  - Q1: core competency required by the JD
  - Q2: past experience on similar responsibilities
  - Q3: specific tools/skills from the JD
  - Q4: realistic problem-solving scenario
  - Q5: collaboration or stakeholder management (if role requires it)
  - Q6: depth probe on candidate's strongest claimed area (pulled from resume)
Frame as: "Tell me about a time...", "How have you handled...", "Walk me through..."

RESUME_VERIFY (exactly 2 questions):
Pick 2 specific claims from the resume above and ask open questions to verify them.
Focus on: specific roles, companies, projects, numbers the candidate mentioned.
Examples: "Your resume mentions [specific claim] - walk me through what you actually did."

CTC: {ctc_instruction}

RECRUITER_CUSTOM: {recruiter_instruction}

CRITICAL RULES:
- Each question: one sentence, max 30 words, conversational tone.
- No jargon the candidate wouldn't understand from their resume.
- Address the candidate by first name "{first_name}" when natural.
- NO greetings, NO "Let's start with...", NO closing lines. Just the questions.
- OUTPUT ONLY THE JSON. No explanation before or after. No code fences.
"""


async def _call_llm_for_questions(prompt: str) -> dict[str, list[str]]:
    """Call Groq with the extraction prompt. Returns parsed dict or raises LLMServiceError."""

    settings = get_settings()

    if not settings.llm_api_key:
        raise LLMServiceError("LLM API key not configured")

    payload: dict[str, Any] = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": "You are a precise JSON-output API. Output ONLY valid JSON, nothing else."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 1500,  # gpt-5-mini is more concise than Llama
        "response_format": {"type": "json_object"},
    }

    try:
        async with httpx.AsyncClient(timeout=45.0, verify=False) as client:  # Corporate SSL proxy - matches report_worker.py pattern
            resp = await client.post(
                f"{settings.llm_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.llm_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if resp.status_code >= 400:
            logger.error("llm_error", status=resp.status_code, body=resp.text[:500])
            raise LLMServiceError(f"LLM returned {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        content = data["choices"][0]["message"]["content"]

        # Strip code fences if the model returned them despite instructions
        content = content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        parsed = json.loads(content)
        logger.info("llm_questions_generated", categories=list(parsed.keys()))
        return parsed

    except httpx.HTTPError as exc:
        logger.error("llm_http_error", error=str(exc))
        raise LLMServiceError(f"HTTP error calling LLM: {exc}") from exc
    except (KeyError, json.JSONDecodeError) as exc:
        logger.error("llm_parse_error", error=str(exc), content_preview=content[:300] if 'content' in dir() else "")
        raise LLMServiceError(f"Failed to parse LLM response: {exc}") from exc


def _normalize_parsed(parsed: dict[str, Any]) -> dict[str, list[str]]:
    """Ensure all 5 category keys exist and have lists of strings. Defensive."""
    result: dict[str, list[str]] = {}
    for cat in CATEGORIES:
        value = parsed.get(cat, [])
        if not isinstance(value, list):
            logger.warning("non_list_category", category=cat, type=type(value).__name__)
            value = []
        # Coerce each item to str and filter empties
        result[cat] = [str(q).strip() for q in value if q and str(q).strip()]
    return result


async def generate_and_save_questions(
    candidate_id: str,
    db: AsyncSession,
) -> dict[str, list[str]]:
    """Generate questions for a candidate and persist to DB.

    Deletes any existing questions for this candidate first (idempotent regenerate).

    Returns the dict of categories -> list of question strings as saved.
    """

    # Load candidate
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise ValueError(f"Candidate not found: {candidate_id}")

    # Load job
    job_result = await db.execute(select(Job).where(Job.id == candidate.job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise ValueError(f"Job not found for candidate: {candidate.job_id}")

    # Extract recruiter custom questions (may live as JSON on the job or a list)
    recruiter_qs_raw = getattr(job, "recruiter_questions", None) or []
    if isinstance(recruiter_qs_raw, str):
        try:
            recruiter_qs_raw = json.loads(recruiter_qs_raw)
        except json.JSONDecodeError:
            recruiter_qs_raw = []
    recruiter_questions = [str(q).strip() for q in recruiter_qs_raw if q and str(q).strip()]

    ask_ctc = bool(getattr(job, "ask_ctc", False))

    # Build prompt
    prompt = _build_extraction_prompt(
        job_title=job.title or "the role",
        jd_text=getattr(job, "jd_raw_text", "") or "",
        requirements=getattr(job, "requirements", "") or "",
        resume_text=candidate.resume_raw_text or "",
        candidate_name=candidate.full_name or candidate.email.split("@")[0],
        office_locations=getattr(job, "office_locations", "") or "",
        shift_info=getattr(job, "shift_info", "") or "",
        ask_ctc=ask_ctc,
        recruiter_questions=recruiter_questions,
    )

    # Call LLM
    raw_questions = await _call_llm_for_questions(prompt)
    normalized = _normalize_parsed(raw_questions)

    # Delete existing questions for this candidate (idempotent regenerate)
    await db.execute(
        delete(InterviewQuestion).where(InterviewQuestion.candidate_id == candidate_id)
    )

    # Insert fresh rows
    rows_added = 0
    for category in CATEGORIES:
        for position, text_val in enumerate(normalized.get(category, [])):
            row = InterviewQuestion(
                candidate_id=candidate_id,
                job_id=candidate.job_id,
                category=category,
                position=position,
                question_text=text_val,
                is_custom=(category == "recruiter_custom"),  # recruiter-provided = custom
            )
            db.add(row)
            rows_added += 1

    await db.commit()

    logger.info(
        "questions_saved",
        candidate_id=candidate_id,
        job_id=candidate.job_id,
        total=rows_added,
        per_category={k: len(v) for k, v in normalized.items()},
    )

    return normalized