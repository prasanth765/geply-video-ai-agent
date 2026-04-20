from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationFailed, EntityNotFound, PermissionDenied
from app.core.security import decode_token
from app.models.base import get_db
from app.models.user import User
from app.repositories.job_repo import JobRepository
from app.repositories.candidate_repo import CandidateRepository
from app.repositories.report_repo import ReportRepository
from app.repositories.interview_repo import InterviewRepository
from app.services.auth_service import AuthService

DBSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DBSession,
    authorization: str = Header(default=""),
) -> User:
    """Extract and validate JWT from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise AuthenticationFailed(reason="Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise AuthenticationFailed(reason="Invalid token type")
    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationFailed(reason="Invalid token payload")
    auth_service = AuthService(db)
    user = await auth_service.get_current_user(user_id)
    if not user or not user.is_active:
        raise AuthenticationFailed(reason="User not found or inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Ownership verification helpers ──
# Every resource endpoint calls one of these before proceeding.
# Admin bypasses ownership checks.


async def verify_job_owner(job_id: str, user: User, db: AsyncSession):
    """Verify the current user owns this job. Admin bypasses."""
    repo = JobRepository(db)
    job = await repo.get_by_id(job_id)
    if not job:
        raise EntityNotFound("Job", job_id)
    if not user.is_admin and job.recruiter_id != user.id:
        raise PermissionDenied("access this job")
    return job


async def verify_candidate_owner(candidate_id: str, user: User, db: AsyncSession):
    """Verify the current user owns the job this candidate belongs to."""
    repo = CandidateRepository(db)
    candidate = await repo.get_by_id(candidate_id)
    if not candidate:
        raise EntityNotFound("Candidate", candidate_id)
    job_repo = JobRepository(db)
    job = await job_repo.get_by_id(candidate.job_id)
    if not job:
        raise EntityNotFound("Job", candidate.job_id)
    if not user.is_admin and job.recruiter_id != user.id:
        raise PermissionDenied("access this candidate")
    return candidate, job


async def verify_report_owner(report_id: str, user: User, db: AsyncSession):
    """Verify the current user owns the job this report belongs to."""
    repo = ReportRepository(db)
    report = await repo.get_by_id(report_id)
    if not report:
        raise EntityNotFound("Report", report_id)
    job_repo = JobRepository(db)
    job = await job_repo.get_by_id(report.job_id)
    if not job:
        raise EntityNotFound("Job", report.job_id)
    if not user.is_admin and job.recruiter_id != user.id:
        raise PermissionDenied("access this report")
    return report, job
