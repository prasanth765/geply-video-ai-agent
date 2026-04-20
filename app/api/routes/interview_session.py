"""
app/api/routes/interview_session.py
GET /api/v1/interview/session/{token}
"""
from __future__ import annotations
import uuid as _uuid
import jwt as pyjwt
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text as sa_text

from app.api.deps import get_db
from app.core.config import get_settings

router = APIRouter(prefix="/interview", tags=["interview"])


class SessionResponse(BaseModel):
    interview_id: str
    candidate_id: str
    job_id: str
    candidate_name: str
    candidate_email: str
    job_title: str
    job_location: str
    job_shift: str
    recruiter_name: str


@router.get("/session/{token}", response_model=SessionResponse)
async def get_interview_session(token: str, db: AsyncSession = Depends(get_db)):
    # Decode JWT
    try:
        settings = get_settings()
        payload = pyjwt.decode(token, settings.jwt_secret,
                               algorithms=["HS256"], options={"verify_exp": True})
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Interview link has expired.")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid interview link.")

    if payload.get("type") != "invite":
        raise HTTPException(status_code=401, detail="Invalid token type.")

    candidate_id = payload.get("sub", "")
    job_id = payload.get("job_id", "")
    if not candidate_id or not job_id:
        raise HTTPException(status_code=400, detail="Token missing fields.")

    # Load candidate
    row = (await db.execute(
        sa_text("SELECT email, full_name FROM candidates WHERE id = :id"),
        {"id": candidate_id}
    )).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    email, full_name = row[0], row[1]
    candidate_name = (full_name.strip() if full_name and full_name.strip()
                      else email.split("@")[0].replace(".", " ").title())

    # Load job
    row = (await db.execute(
        sa_text("SELECT title, office_locations, shift_info, recruiter_id FROM jobs WHERE id = :id"),
        {"id": job_id}
    )).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Job not found.")
    job_title, job_location, job_shift, recruiter_id = row[0], row[1] or "our offices", row[2] or "standard hours", row[3]

    # Recruiter name
    recruiter_name = "GEP"
    if recruiter_id:
        row = (await db.execute(
            sa_text("SELECT full_name FROM users WHERE id = :id"),
            {"id": recruiter_id}
        )).fetchone()
        if row and row[0] and row[0].strip():
            recruiter_name = row[0].strip().split()[0]

    # Find or create interview
    row = (await db.execute(
        sa_text("SELECT id FROM interviews WHERE candidate_id=:cid AND job_id=:jid LIMIT 1"),
        {"cid": candidate_id, "jid": job_id}
    )).fetchone()

    if row:
        interview_id = str(row[0])
    else:
        interview_id = str(_uuid.uuid4())
        await db.execute(sa_text(
            "INSERT INTO interviews (id,candidate_id,job_id,room_name,status,"
            "duration_seconds,recording_path,transcript,overall_score,"
            "technical_score,communication_score,problem_solving_score,"
            "proctor_score,livekit_room_sid,egress_id) VALUES "
            "(:id,:cid,:jid,:room,'pending',0,'','',0.0,0.0,0.0,0.0,100.0,'','')"
        ), {"id": interview_id, "cid": candidate_id, "jid": job_id,
            "room": f"geply-{_uuid.uuid4().hex[:12]}"})
        await db.commit()

    return SessionResponse(
        interview_id=interview_id,
        candidate_id=candidate_id,
        job_id=job_id,
        candidate_name=candidate_name,
        candidate_email=email,
        job_title=job_title,
        job_location=job_location,
        job_shift=job_shift,
        recruiter_name=recruiter_name,
    )
