from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession, verify_job_owner
from app.schemas.job import (
    BulkInviteResponse,
    JobCreateRequest,
    JobListResponse,
    JobResponse,
)
from app.services.job_service import JobService

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    requirements: str | None = None
    status: str | None = None
    interview_duration_minutes: int | None = None
    max_questions: int | None = None
    office_locations: str | None = None
    shift_flexible: bool | None = None
    shift_info: str | None = None
    ask_ctc: bool | None = None
    recruiter_questions: list[str] | None = None


@router.post("", response_model=JobResponse, status_code=201)
async def create_job(
    db: DBSession,
    user: CurrentUser,
    title: str = Form(...),
    description: str = Form(default=""),
    requirements: str = Form(default=""),
    interview_duration_minutes: int = Form(default=30),
    max_questions: int = Form(default=10),
    difficulty_level: str = Form(default="medium"),
    office_locations: str = Form(default=""),
    shift_flexible: bool = Form(default=True),
    jd_file: UploadFile | None = File(default=None),
) -> JobResponse:
    """Create a job posting. Optionally upload a JD file (PDF/DOCX)."""
    service = JobService(db)

    jd_bytes: bytes | None = None
    jd_filename = ""
    if jd_file and jd_file.filename:
        jd_bytes = await jd_file.read()
        jd_filename = jd_file.filename

    data = JobCreateRequest(
        title=title,
        description=description,
        requirements=requirements,
        interview_duration_minutes=interview_duration_minutes,
        max_questions=max_questions,
        difficulty_level=difficulty_level,
        office_locations=office_locations,
        shift_flexible=shift_flexible,
    )
    return await service.create_job(
        recruiter_id=user.id,
        data=data,
        jd_file_bytes=jd_bytes,
        jd_filename=jd_filename,
    )


@router.get("", response_model=JobListResponse)
async def list_jobs(
    db: DBSession,
    user: CurrentUser,
    offset: int = 0,
    limit: int = 50,
) -> JobListResponse:
    service = JobService(db)
    jobs, total = await service.list_jobs(user.id, offset, limit)
    return JobListResponse(jobs=jobs, total=total)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, db: DBSession, user: CurrentUser) -> JobResponse:
    await verify_job_owner(job_id, user, db)
    service = JobService(db)
    return await service.get_job(job_id)


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    body: JobUpdateRequest,
    db: DBSession,
    user: CurrentUser,
) -> JobResponse:
    await verify_job_owner(job_id, user, db)
    service = JobService(db)
    return await service.update_job(
        job_id=job_id,
        **body.model_dump(exclude_none=True),
    )


@router.delete("/{job_id}")
async def delete_job(job_id: str, db: DBSession, user: CurrentUser) -> dict:
    await verify_job_owner(job_id, user, db)
    service = JobService(db)
    return await service.delete_job(job_id)


@router.post("/{job_id}/resumes", status_code=201)
async def upload_resumes(
    job_id: str,
    db: DBSession,
    user: CurrentUser,
    files: list[UploadFile] = File(...),
    emails: str = Form(default=""),
) -> dict:
    await verify_job_owner(job_id, user, db)
    service = JobService(db)
    email_list = [e.strip() for e in emails.split(",") if e.strip()] if emails else []
    file_tuples: list[tuple[bytes, str, str]] = []

    for idx, f in enumerate(files):
        content = await f.read()
        email = email_list[idx] if idx < len(email_list) else ""
        file_tuples.append((content, f.filename or f"resume_{idx}.pdf", email))

    candidates = await service.upload_resumes_bulk(job_id, file_tuples)
    return {
        "job_id": job_id,
        "uploaded": len(candidates),
        "candidate_ids": [c.id for c in candidates],
    }


@router.post("/{job_id}/invites", response_model=BulkInviteResponse)
async def generate_invites(
    job_id: str,
    db: DBSession,
    user: CurrentUser,
) -> BulkInviteResponse:
    await verify_job_owner(job_id, user, db)
    service = JobService(db)
    result = await service.generate_bulk_invites(job_id)
    return result

