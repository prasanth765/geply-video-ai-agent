"""
Stateless password reset via signed JWT.

No DB table. Token is a short-lived JWT embedding a fingerprint of the
user's current password hash -- once the password changes, old tokens
auto-invalidate.

Dev mode (no RESEND_API_KEY): reset link returned in response + logged.
Prod mode (RESEND_API_KEY set): emailed via Resend API.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

from app.api.deps import DBSession
from app.core.config import get_settings
from app.core.security import hash_password
from app.models.user import User
from app.services.email_service import email_service

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/auth", tags=["password-reset"])

RESET_TOKEN_TYPE = "password_reset"
RESET_TOKEN_EXPIRE_MINUTES = 15


# -- Schemas ------------------------------------------------------------
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    success: bool = True
    message: str
    email_masked: str
    dev_reset_link: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20)
    new_password: str = Field(min_length=8, max_length=128)


class ResetPasswordResponse(BaseModel):
    success: bool = True
    message: str


# -- Helpers ------------------------------------------------------------
def _password_fingerprint(hashed_password: str) -> str:
    return hashed_password[-10:]


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        return email
    return f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}@{domain}"


def _create_reset_token(user: User) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "email": user.email,
        "pwd_fp": _password_fingerprint(user.hashed_password),
        "type": RESET_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def _verify_reset_token(token: str, db) -> User:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid reset link.")

    if payload.get("type") != RESET_TOKEN_TYPE:
        raise HTTPException(status_code=400, detail="Invalid reset link.")

    user = (
        await db.execute(select(User).where(User.id == payload["sub"]))
    ).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Invalid reset link.")

    if payload.get("pwd_fp") != _password_fingerprint(user.hashed_password):
        raise HTTPException(status_code=400, detail="Reset link has already been used.")

    return user


# -- Endpoints ----------------------------------------------------------
@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(body: ForgotPasswordRequest, db: DBSession) -> ForgotPasswordResponse:
    settings = get_settings()
    email = body.email.lower().strip()

    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()

    reset_link: str | None = None
    if user and user.is_active:
        token = _create_reset_token(user)
        reset_link = f"{settings.frontend_url}/reset-password?token={token}"
        await email_service.send_reset_link(
            to_email=user.email,
            user_name=user.full_name,
            reset_link=reset_link,
        )
        logger.info("password_reset_requested", user_id=user.id, email=email)
    else:
        logger.info("password_reset_requested_unknown_email", email=email)

    return ForgotPasswordResponse(
        message="If an account exists with this email, a reset link has been sent.",
        email_masked=_mask_email(email),
        dev_reset_link=reset_link if settings.debug else None,
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(body: ResetPasswordRequest, db: DBSession) -> ResetPasswordResponse:
    user = await _verify_reset_token(body.token, db)
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    logger.info("password_reset_completed", user_id=user.id, email=user.email)
    return ResetPasswordResponse(message="Password updated. You can now sign in.")
