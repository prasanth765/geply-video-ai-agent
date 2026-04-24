from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import ALLOWED_RESUME_EXTENSIONS, MAX_RESUME_SIZE_MB, CandidateStatus
from app.core.exceptions import EntityNotFound, FileUploadError
from app.core.security import create_invite_token
from app.models.candidate import Candidate
from app.models.job import Job
from app.repositories.candidate_repo import CandidateRepository
from app.repositories.job_repo import JobRepository
from app.schemas.job import BulkInviteResponse, JobCreateRequest, JobResponse
from app.utils.file_storage import save_upload
from app.utils.resume_parser import extract_text_from_file
from app.utils.contact_extractor import extract_contact_info
from app.utils.notify import create_notification_async

logger = structlog.get_logger()

# Placeholder email domain for candidates with no email in resume
_PENDING_EMAIL_DOMAIN = "@pending.geply"


class JobService:
    def __init__(self, session: AsyncSession) -> None:
        self.job_repo = JobRepository(session)
        self.candidate_repo = CandidateRepository(session)
        self.session = session
        self.settings = get_settings()

    async def create_job(
        self,
        recruiter_id: str,
        data: JobCreateRequest,
        jd_file_bytes: bytes | None = None,
        jd_filename: str = "",
    ) -> JobResponse:
        jd_path = ""
        jd_text = data.description

        if jd_file_bytes and jd_filename:
            jd_path = await save_upload(jd_file_bytes, jd_filename, subfolder="jd")
            jd_text = await extract_text_from_file(jd_path)

        job = await self.job_repo.create(
            recruiter_id=recruiter_id,
            title=data.title,
            description=data.description or jd_text,
            requirements=data.requirements,
            jd_file_path=jd_path,
            jd_raw_text=jd_text,
            interview_duration_minutes=data.interview_duration_minutes,
            max_questions=data.max_questions,
            difficulty_level=data.difficulty_level,
            office_locations=data.office_locations,
            shift_flexible=data.shift_flexible,
            shift_info=data.shift_info,
        )
        logger.info("job_created", job_id=job.id, title=data.title)
        count = await self.job_repo.get_candidate_count(job.id)
        resp = JobResponse.model_validate(job)
        resp.candidate_count = count

        await self._notify_safe(
            recruiter_id, "job_created",
            f"New job: {data.title}",
            f"Job '{data.title}' created successfully",
            metadata={"job_id": job.id},
        )
        return resp

    async def update_job(
        self,
        job_id: str,
        title: str | None = None,
        description: str | None = None,
        requirements: str | None = None,
        status: str | None = None,
        interview_duration_minutes: int | None = None,
        max_questions: int | None = None,
        office_locations: str | None = None,
        shift_flexible: bool | None = None,
        shift_info: str | None = None,
        ask_ctc: bool | None = None,
        recruiter_questions: list[str] | None = None,
    ) -> JobResponse:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            raise EntityNotFound("Job", job_id)

        if title is not None:
            job.title = title
        if description is not None:
            job.description = description
            job.jd_raw_text = description
        if requirements is not None:
            job.requirements = requirements
        if status is not None:
            job.status = status
        if interview_duration_minutes is not None:
            job.interview_duration_minutes = interview_duration_minutes
        if max_questions is not None:
            job.max_questions = max_questions
        if office_locations is not None:
            job.office_locations = office_locations
        if shift_flexible is not None:
            job.shift_flexible = shift_flexible
        if shift_info is not None:
            job.shift_info = shift_info
        if ask_ctc is not None:
            job.ask_ctc = ask_ctc
        if recruiter_questions is not None:
            job.recruiter_questions = recruiter_questions

        await self.session.flush()
        await self.session.commit()  # explicit commit ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â update_job is called outside get_db auto-commit
        logger.info("job_updated", job_id=job_id)
        count = await self.job_repo.get_candidate_count(job_id)
        resp = JobResponse.model_validate(job)
        resp.candidate_count = count
        return resp

    async def delete_job(self, job_id: str) -> dict:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            raise EntityNotFound("Job", job_id)
        title = job.title
        await self.session.delete(job)
        await self.session.flush()
        logger.info("job_deleted", job_id=job_id, title=title)
        return {"deleted": True, "job_id": job_id, "title": title}

    async def upload_resumes_bulk(
        self,
        job_id: str,
        files: list[tuple[bytes, str, str]],
    ) -> list[Candidate]:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            raise EntityNotFound("Job", job_id)

        existing_candidates, _ = await self.candidate_repo.get_by_job(job_id, offset=0, limit=10000)
        existing_names = {c.full_name.strip().lower() for c in existing_candidates if c.full_name}
        existing_emails = {
            c.email.strip().lower() for c in existing_candidates
            if c.email and _PENDING_EMAIL_DOMAIN not in c.email
        }

        candidates: list[Candidate] = []
        skipped = 0

        for content, filename, provided_email in files:
            ext = Path(filename).suffix.lower()
            if ext not in ALLOWED_RESUME_EXTENSIONS:
                continue
            if len(content) / (1024 * 1024) > MAX_RESUME_SIZE_MB:
                continue

            file_path = await save_upload(content, filename, subfolder=f"resumes/{job_id}")
            resume_text = ""
            try:
                resume_text = await extract_text_from_file(file_path)
            except Exception as exc:
                logger.error("resume_parse_failed", filename=filename, error=str(exc))

            contact = extract_contact_info(resume_text)
            extracted_name = contact.get("name", "")
            extracted_email = contact.get("email", "")
            extracted_phone = contact.get("phone", "")

            name = extracted_name or _clean_name_from_filename(filename)
            email = provided_email or extracted_email or ""
            phone = extracted_phone or ""

            name_lower = name.strip().lower()
            email_lower = email.strip().lower() if email else ""

            is_duplicate = False
            if email_lower and email_lower in existing_emails:
                is_duplicate = True
                logger.info("duplicate_email_skipped", filename=filename, email=email, job_id=job_id)
            elif name_lower and name_lower in existing_names:
                is_duplicate = True
                logger.info("duplicate_name_skipped", filename=filename, name=name, job_id=job_id)

            if is_duplicate:
                skipped += 1
                continue

            final_email = email or f"{uuid.uuid4().hex[:8]}{_PENDING_EMAIL_DOMAIN}"
            candidate = await self.candidate_repo.create(
                job_id=job_id,
                email=final_email,
                full_name=name,
                phone=phone,
                resume_file_path=file_path,
                resume_raw_text=resume_text,
                resume_parsed=bool(resume_text),
                status="pending",
            )
            candidates.append(candidate)
            existing_names.add(name_lower)
            if email_lower:
                existing_emails.add(email_lower)

        logger.info("bulk_resumes_uploaded", job_id=job_id,
                     uploaded=len(candidates), skipped=skipped)

        if candidates:
            await self._notify_safe(
                job.recruiter_id, "candidate_uploaded",
                f"{len(candidates)} candidate(s) added",
                f"{len(candidates)} resume(s) uploaded for {job.title}"
                + (f" ({skipped} duplicates skipped)" if skipped else ""),
                metadata={"job_id": job_id},
            )
        return candidates

    async def generate_bulk_invites(
        self,
        job_id: str,
        candidate_ids: list[str] | None = None,
    ) -> BulkInviteResponse:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            raise EntityNotFound("Job", job_id)

        if candidate_ids:
            targets = []
            for cid in candidate_ids:
                c = await self.candidate_repo.get_by_id(cid)
                if c and c.job_id == job_id and c.status in ("pending", "invited"):
                    targets.append(c)
        else:
            targets = list(await self.candidate_repo.get_uninvited(job_id))

        invites_generated = 0
        failed: list[str] = []

        # Import here to avoid circular import (service -> service)
        from app.services.question_service import generate_and_save_questions

        for candidate in targets:
            try:
                # -- Generate interview questions FIRST (hard requirement) --
                # If LLM fails, the candidate does NOT get invited. We prefer
                # a failed-invite retry over sending an invite that leads to
                # an empty interview.
                await generate_and_save_questions(candidate.id, self.session)

                # -- Create invite token (only reached if questions succeeded) --
                token = create_invite_token(
                    candidate_id=candidate.id,
                    job_id=job_id,
                    candidate_email=candidate.email,
                )
                candidate.invite_token = token
                candidate.status = CandidateStatus.INVITED
                candidate.invite_sent_at = datetime.now(timezone.utc)
                invites_generated += 1
                logger.info("invite_with_questions_ready",
                            candidate_id=candidate.id)
            except Exception as exc:
                logger.error("invite_generation_failed",
                             candidate_id=candidate.id, error=str(exc))
                failed.append(candidate.id)

        await self.session.flush()

        if invites_generated > 0:
            await self._notify_safe(
                job.recruiter_id, "invite_sent",
                f"Invites sent: {invites_generated} candidate(s)",
                f"{invites_generated} invite link(s) generated for {job.title}",
                metadata={"job_id": job_id},
            )
        logger.info("bulk_invites_generated", job_id=job_id,
                     total=len(targets), generated=invites_generated)

        return BulkInviteResponse(
            job_id=job_id,
            total_candidates=len(targets),
            invites_generated=invites_generated,
            invites_sent=0,
            failed=failed,
        )

    async def get_job(self, job_id: str) -> JobResponse:
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            raise EntityNotFound("Job", job_id)
        count = await self.job_repo.get_candidate_count(job_id)
        resp = JobResponse.model_validate(job)
        resp.candidate_count = count
        return resp

    async def list_jobs(
        self,
        recruiter_id: str,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[JobResponse], int]:
        jobs, total = await self.job_repo.get_by_recruiter(recruiter_id, offset, limit)
        results = []
        for j in jobs:
            count = await self.job_repo.get_candidate_count(j.id)
            resp = JobResponse.model_validate(j)
            resp.candidate_count = count
            results.append(resp)
        return results, total

    # ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ Internal helpers ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬

    async def _notify_safe(
        self,
        recruiter_id: str,
        notification_type: str,
        title: str,
        message: str,
        metadata: dict | None = None,
    ) -> None:
        """Create a notification, logging but never raising on failure."""
        try:
            await create_notification_async(
                self.session, recruiter_id, notification_type,
                title, message, metadata=metadata,
            )
        except Exception as exc:
            logger.warning("notification_failed", type=notification_type, error=str(exc))
