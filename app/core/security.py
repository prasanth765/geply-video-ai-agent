from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.exceptions import AuthenticationFailed, TokenExpired

# ── bcrypt silently truncates passwords beyond 72 bytes ──
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    """Hash a password using bcrypt. Raises if password exceeds bcrypt's 72-byte limit."""
    encoded = password.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password exceeds bcrypt's {MAX_PASSWORD_BYTES}-byte limit. "
            "Use a shorter password or implement pre-hashing."
        )
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    """Create a JWT access token for authenticated sessions."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
        "iat": now,
        "type": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_invite_token(
    candidate_id: str,
    job_id: str,
    candidate_email: str,
) -> str:
    """Create a JWT invite token for candidate interview links (72h expiry)."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": candidate_id,
        "job_id": job_id,
        "email": candidate_email,
        "exp": now + timedelta(hours=settings.jwt_invite_token_expire_hours),
        "iat": now,
        "type": "invite",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT token. Raises specific exceptions for expired or invalid tokens."""
    settings = get_settings()
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpired() from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationFailed(reason="Invalid token") from exc


def create_livekit_room_token(
    room_name: str,
    participant_identity: str,
    participant_name: str,
    is_agent: bool = False,
) -> str:
    """Create a LiveKit room token. Raises if LiveKit credentials are not configured."""
    settings = get_settings()

    if not settings.livekit_api_key or not settings.livekit_api_secret:
        import structlog as _sl
        _sl.get_logger().warning("livekit_not_configured")
        return ""

    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=2)

    grant: dict[str, Any] = {
        "roomJoin": True,
        "room": room_name,
        "canPublish": True,
        "canSubscribe": True,
    }

    if is_agent:
        grant["canPublishData"] = True
        grant["hidden"] = False
        grant["agent"] = True

    payload = {
        "exp": int(expires.timestamp()),
        "iss": settings.livekit_api_key,
        "nbf": int(now.timestamp()),
        "sub": participant_identity,
        "name": participant_name,
        "video": grant,
    }

    return jwt.encode(payload, settings.livekit_api_secret, algorithm="HS256")
