from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select, text

from app.api.deps import CurrentUser, DBSession
from app.core.exceptions import PermissionDenied
from app.core.config import get_settings
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.core.constants import InterviewStatus
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

# Supported avatar extensions — order matters for _find_avatar_url()
_AVATAR_EXTS = (".png", ".webp", ".jpg", ".jpeg")


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    company: str | None = None


class StatsResponse(BaseModel):
    active_jobs: int = 0
    interviews_done: int = 0
    total_candidates: int = 0


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: RegisterRequest, db: DBSession) -> UserResponse:
    service = AuthService(db)
    return await service.register(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        company=body.company,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: DBSession) -> TokenResponse:
    service = AuthService(db)
    return await service.login(email=body.email, password=body.password)


@router.get("/me", response_model=UserResponse)
async def get_me(user: CurrentUser) -> UserResponse:
    resp = UserResponse.model_validate(user)
    # Compute avatar URL from disk (not stored in DB)
    resp.avatar_url = _find_avatar_url(user.id)
    return resp


def _find_avatar_url(user_id: str) -> str:
    """Check disk for avatar file, return serving URL or empty string."""
    settings = get_settings()
    avatar_dir = Path(settings.storage_local_path) / "avatars"
    for ext in _AVATAR_EXTS:
        path = avatar_dir / f"{user_id}{ext}"
        if path.exists() and path.stat().st_size > 1024:
            return f"/api/v1/auth/avatar/{user_id}{ext}"
    return ""


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    user: CurrentUser,
    db: DBSession,
) -> UserResponse:
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.company is not None:
        user.company = body.company
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/profile/avatar")
async def upload_avatar(
    user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(...),
) -> dict:
    settings   = get_settings()
    upload_dir = Path(settings.storage_local_path) / "avatars"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # BUG 2 FIX: Delete ALL existing avatar files for this user before saving.
    # Previously, re-uploading left the old file on disk. The extension loop
    # would find the old (possibly ghost/empty) file first and serve it instead
    # of the new photo.
    for ext in _AVATAR_EXTS:
        old_path = upload_dir / f"{user.id}{ext}"
        if old_path.exists():
            old_path.unlink()

    ext      = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"{user.id}{ext}"
    filepath = upload_dir / filename

    content = await file.read()
    filepath.write_bytes(content)

    avatar_url = f"/api/v1/auth/avatar/{filename}"
    return {"avatar_url": avatar_url, "filename": filename}


@router.get("/avatar/{filename}")
async def get_avatar(filename: str):
    from fastapi.responses import FileResponse, JSONResponse
    settings  = get_settings()
    file_path = Path(settings.storage_local_path) / "avatars" / filename
    if not file_path.exists():
        return JSONResponse(status_code=404, content={"error": "Not found"})
    return FileResponse(str(file_path))


@router.get("/stats", response_model=StatsResponse)
async def get_stats(user: CurrentUser, db: DBSession) -> StatsResponse:
    jobs_count = (await db.execute(
        select(func.count()).where(Job.recruiter_id == user.id)
    )).scalar_one()

    job_ids = (await db.execute(
        select(Job.id).where(Job.recruiter_id == user.id)
    )).scalars().all()

    candidates_count = 0
    interviews_count = 0

    if job_ids:
        candidates_count = (await db.execute(
            select(func.count()).where(Candidate.job_id.in_(job_ids))
        )).scalar_one()

        interviews_count = (await db.execute(
            select(func.count()).where(
                Interview.job_id.in_(job_ids),
                Interview.status == InterviewStatus.COMPLETED,
            )
        )).scalar_one()

    return StatsResponse(
        active_jobs=jobs_count,
        interviews_done=interviews_count,
        total_candidates=candidates_count,
    )


# ── Company Knowledge Base endpoints ─────────────────────────────────────────
@router.get("/settings/kb")
async def get_kb(user: CurrentUser, db: DBSession) -> dict:
    row = (await db.execute(
        text("SELECT value FROM app_settings WHERE key = 'company_kb'")
    )).fetchone()
    return {"company_kb": row[0] if row else ""}


@router.patch("/settings/kb")
async def update_kb(request: Request, user: CurrentUser, db: DBSession) -> dict:
    if not user.is_admin:
        raise PermissionDenied("update the company knowledge base")

    body = await request.json()
    kb   = body.get("company_kb", "")

    await db.execute(
        text("""
            INSERT OR REPLACE INTO app_settings (key, value, updated_at)
            VALUES ('company_kb', :kb, datetime('now'))
        """),
        {"kb": kb}
    )
    await db.commit()
    return {"company_kb": kb, "length": len(kb)}
