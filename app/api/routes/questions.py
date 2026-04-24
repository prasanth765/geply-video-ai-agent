"""
Candidate Interview Question CRUD endpoints.

All routes are scoped under /api/v1/questions and require recruiter auth
(enforced via verify_candidate_owner which ensures the candidate belongs
to a job owned by the authenticated recruiter).

Endpoints:
  GET    /api/v1/questions/candidate/{candidate_id}          - List all
  POST   /api/v1/questions/candidate/{candidate_id}/generate - LLM generate (or regenerate)
  POST   /api/v1/questions/candidate/{candidate_id}          - Create one (recruiter adds)
  PATCH  /api/v1/questions/{question_id}                     - Edit one
  DELETE /api/v1/questions/{question_id}                     - Delete one
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, verify_job_owner
from app.core.exceptions import EntityNotFound
from app.models.candidate import Candidate
from app.models.interview_question import InterviewQuestion
from app.services.question_service import (
    CATEGORIES,
    generate_and_save_questions,
)

router = APIRouter(prefix="/questions", tags=["questions"])


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Schemas
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


class QuestionResponse(BaseModel):
    """Single question in API responses."""

    id: str
    candidate_id: str
    job_id: str
    category: str
    position: int
    question_text: str
    is_custom: bool

    class Config:
        from_attributes = True


class QuestionListResponse(BaseModel):
    """Grouped response: questions organized by category."""

    candidate_id: str
    by_category: dict[str, list[QuestionResponse]]
    total: int


class CreateQuestionRequest(BaseModel):
    category: str = Field(..., description="One of: hygiene, jd_fit, resume_verify, ctc, recruiter_custom")
    question_text: str = Field(..., min_length=1, max_length=1000)


class UpdateQuestionRequest(BaseModel):
    question_text: str = Field(..., min_length=1, max_length=1000)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Internal helpers
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


async def _verify_candidate_owner(
    candidate_id: str,
    user: CurrentUser,
    db: DBSession,
) -> Candidate:
    """Load candidate and verify the authenticated recruiter owns the parent job."""
    cand = (await db.execute(
        select(Candidate).where(Candidate.id == candidate_id)
    )).scalar_one_or_none()

    if not cand:
        raise EntityNotFound("Candidate", candidate_id)

    # verify_job_owner raises if the recruiter does not own the job
    await verify_job_owner(cand.job_id, user, db)
    return cand


async def _load_questions_by_category(
    candidate_id: str,
    db: DBSession,
) -> QuestionListResponse:
    """Load all questions for a candidate, grouped by category."""
    result = await db.execute(
        select(InterviewQuestion)
        .where(InterviewQuestion.candidate_id == candidate_id)
        .order_by(InterviewQuestion.category, InterviewQuestion.position)
    )
    questions = list(result.scalars().all())

    grouped: dict[str, list[QuestionResponse]] = {cat: [] for cat in CATEGORIES}
    for q in questions:
        if q.category in grouped:
            grouped[q.category].append(QuestionResponse.model_validate(q))

    return QuestionListResponse(
        candidate_id=candidate_id,
        by_category=grouped,
        total=len(questions),
    )


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Endpoints
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


@router.get(
    "/candidate/{candidate_id}",
    response_model=QuestionListResponse,
    summary="List all questions for a candidate, grouped by category",
)
async def list_candidate_questions(
    candidate_id: str,
    db: DBSession,
    user: CurrentUser,
) -> QuestionListResponse:
    await _verify_candidate_owner(candidate_id, user, db)
    return await _load_questions_by_category(candidate_id, db)


@router.post(
    "/candidate/{candidate_id}/generate",
    response_model=QuestionListResponse,
    summary="Generate (or regenerate) questions via LLM - replaces existing set",
)
async def generate_candidate_questions(
    candidate_id: str,
    db: DBSession,
    user: CurrentUser,
) -> QuestionListResponse:
    """Trigger LLM generation. Deletes existing questions first (idempotent)."""
    await _verify_candidate_owner(candidate_id, user, db)
    await generate_and_save_questions(candidate_id, db)
    return await _load_questions_by_category(candidate_id, db)


@router.post(
    "/candidate/{candidate_id}",
    response_model=QuestionResponse,
    status_code=201,
    summary="Add a recruiter-authored question to a category",
)
async def create_question(
    candidate_id: str,
    payload: CreateQuestionRequest,
    db: DBSession,
    user: CurrentUser,
) -> QuestionResponse:
    candidate = await _verify_candidate_owner(candidate_id, user, db)

    if payload.category not in CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(CATEGORIES)}",
        )

    # Compute next position in that category
    result = await db.execute(
        select(InterviewQuestion)
        .where(InterviewQuestion.candidate_id == candidate_id)
        .where(InterviewQuestion.category == payload.category)
        .order_by(InterviewQuestion.position.desc())
    )
    existing = result.scalars().first()
    next_position = (existing.position + 1) if existing else 0

    q = InterviewQuestion(
        candidate_id=candidate_id,
        job_id=candidate.job_id,
        category=payload.category,
        position=next_position,
        question_text=payload.question_text.strip(),
        is_custom=True,
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)

    return QuestionResponse.model_validate(q)


@router.patch(
    "/{question_id}",
    response_model=QuestionResponse,
    summary="Edit a question's text - marks as custom",
)
async def update_question(
    question_id: str,
    payload: UpdateQuestionRequest,
    db: DBSession,
    user: CurrentUser,
) -> QuestionResponse:
    q = (await db.execute(
        select(InterviewQuestion).where(InterviewQuestion.id == question_id)
    )).scalar_one_or_none()

    if not q:
        raise EntityNotFound("Question", question_id)

    # Verify ownership via candidate -> job -> recruiter
    await _verify_candidate_owner(q.candidate_id, user, db)

    q.question_text = payload.question_text.strip()
    q.is_custom = True  # Recruiter touched it
    await db.commit()
    await db.refresh(q)

    return QuestionResponse.model_validate(q)


@router.delete(
    "/{question_id}",
    status_code=204,
    response_class=Response,
    summary="Delete a question",
)
async def delete_question(
    question_id: str,
    db: DBSession,
    user: CurrentUser,
) -> Response:
    q = (await db.execute(
        select(InterviewQuestion).where(InterviewQuestion.id == question_id)
    )).scalar_one_or_none()

    if not q:
        raise EntityNotFound("Question", question_id)

    await _verify_candidate_owner(q.candidate_id, user, db)

    await db.delete(q)
    await db.commit()
    return Response(status_code=204)