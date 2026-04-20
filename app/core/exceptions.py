from __future__ import annotations


class AppException(Exception):
    """Base exception for all domain errors.

    All custom exceptions inherit from this. The global exception handler
    in main.py catches these and returns structured JSON error responses.
    """

    def __init__(
        self,
        message: str,
        code: str,
        status: int = 400,
        context: dict | None = None,
    ) -> None:
        self.message = message
        self.code = code
        self.status = status
        self.context = context or {}
        super().__init__(self.message)


# ── Auth & Permissions ──


class AuthenticationFailed(AppException):
    def __init__(self, reason: str = "Invalid credentials") -> None:
        super().__init__(
            message=reason,
            code="AUTH_FAILED",
            status=401,
        )


class TokenExpired(AppException):
    def __init__(self) -> None:
        super().__init__(
            message="Token has expired",
            code="TOKEN_EXPIRED",
            status=401,
        )


class PermissionDenied(AppException):
    def __init__(self, action: str = "perform this action") -> None:
        super().__init__(
            message=f"You do not have permission to {action}",
            code="PERMISSION_DENIED",
            status=403,
        )


# ── Entity Operations ──


class EntityNotFound(AppException):
    def __init__(self, entity: str, identifier: str) -> None:
        super().__init__(
            message=f"{entity} not found",
            code="ENTITY_NOT_FOUND",
            status=404,
            context={"entity": entity, "id": identifier},
        )


class DuplicateEntity(AppException):
    def __init__(self, entity: str, field: str, value: str) -> None:
        super().__init__(
            message=f"{entity} with {field}='{value}' already exists",
            code="DUPLICATE_ENTITY",
            status=409,
            context={"entity": entity, "field": field, "value": value},
        )


# ── Interview & Scheduling ──


class InviteLinkInvalid(AppException):
    def __init__(self, reason: str = "Invalid or expired invite link") -> None:
        super().__init__(
            message=reason,
            code="INVITE_INVALID",
            status=400,
        )


class InterviewSlotUnavailable(AppException):
    def __init__(self, slot_id: str) -> None:
        super().__init__(
            message="This interview slot is no longer available",
            code="SLOT_UNAVAILABLE",
            status=409,
            context={"slot_id": slot_id},
        )


class InterviewAlreadyCompleted(AppException):
    def __init__(self, interview_id: str) -> None:
        super().__init__(
            message="Interview has already been completed",
            code="INTERVIEW_COMPLETED",
            status=409,
            context={"interview_id": interview_id},
        )


# ── File Operations ──


class FileUploadError(AppException):
    def __init__(self, filename: str, reason: str) -> None:
        super().__init__(
            message=f"Failed to upload {filename}: {reason}",
            code="FILE_UPLOAD_ERROR",
            status=400,
            context={"filename": filename, "reason": reason},
        )


# ── Rate Limiting ──


class RateLimitExceeded(AppException):
    def __init__(self) -> None:
        super().__init__(
            message="Too many requests, please try again later",
            code="RATE_LIMIT_EXCEEDED",
            status=429,
        )


# ── External Services ──


class LLMServiceError(AppException):
    """Raised when the LLM API (Groq/OpenAI) fails or times out."""

    def __init__(self, reason: str = "AI service temporarily unavailable") -> None:
        super().__init__(
            message=reason,
            code="LLM_SERVICE_ERROR",
            status=502,
        )


class ServiceUnavailable(AppException):
    """Raised when an external dependency (TTS, email, etc.) is unreachable."""

    def __init__(self, service: str, reason: str = "") -> None:
        detail = f"{service} is temporarily unavailable"
        if reason:
            detail = f"{detail}: {reason}"
        super().__init__(
            message=detail,
            code="SERVICE_UNAVAILABLE",
            status=503,
            context={"service": service},
        )
