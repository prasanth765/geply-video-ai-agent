from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, DBSession, verify_job_owner, verify_report_owner
from app.core.exceptions import EntityNotFound
from app.repositories.report_repo import ReportRepository
from app.schemas.report import ReportListResponse, ReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])


def _to_response(report) -> ReportResponse:
    """Convert a Report model to response, injecting transcript + JD Match from related rows."""
    resp = ReportResponse.model_validate(report)
    # Transcript comes from the related Interview row
    if report.interview and report.interview.transcript:
        resp.transcript = report.interview.transcript
    # JD Match fields come from the related Candidate row (pre-interview screening)
    if report.candidate:
        resp.jd_match_score = report.candidate.jd_match_score or 0
        resp.jd_match_verdict = report.candidate.jd_match_verdict or ""
        resp.jd_match_breakdown = report.candidate.jd_match_breakdown or ""
    return resp


@router.get("/job/{job_id}", response_model=ReportListResponse)
async def list_reports(
    job_id: str,
    db: DBSession,
    user: CurrentUser,
    offset: int = 0,
    limit: int = 100,
) -> ReportListResponse:
    await verify_job_owner(job_id, user, db)
    repo = ReportRepository(db)
    reports, total = await repo.get_by_job(job_id, offset, limit)
    return ReportListResponse(
        reports=[_to_response(r) for r in reports],
        total=total,
    )


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: str,
    db: DBSession,
    user: CurrentUser,
) -> ReportResponse:
    report, _ = await verify_report_owner(report_id, user, db)
    return _to_response(report)


@router.get("/interview/{interview_id}", response_model=ReportResponse)
async def get_report_by_interview(
    interview_id: str,
    db: DBSession,
    user: CurrentUser,
) -> ReportResponse:
    repo = ReportRepository(db)
    report = await repo.get_by_interview(interview_id)
    if not report:
        raise EntityNotFound("Report", f"interview:{interview_id}")
    return _to_response(report)
