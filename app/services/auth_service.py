from __future__ import annotations

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import AuthenticationFailed, DuplicateEntity
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.auth import TokenResponse, UserResponse

logger = structlog.get_logger()


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = UserRepository(session)
        self.settings = get_settings()

    async def register(
        self,
        email: str,
        password: str,
        full_name: str,
        company: str = "",
    ) -> UserResponse:
        if not email.lower().endswith('@gep.com'):
            raise AuthenticationFailed(reason="Only @gep.com email addresses can register")
        existing = await self.repo.get_by_email(email)
        if existing:
            raise DuplicateEntity("User", "email", email)

        user = await self.repo.create(
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            company=company,
        )
        logger.info("user_registered", user_id=user.id, email=email)
        return UserResponse.model_validate(user)

    async def login(self, email: str, password: str) -> TokenResponse:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise AuthenticationFailed()
        if not user.is_active:
            raise AuthenticationFailed(reason="Account is deactivated")

        token = create_access_token(
            subject=user.id,
            extra={"email": user.email, "is_admin": user.is_admin},
        )
        logger.info("user_logged_in", user_id=user.id)
        return TokenResponse(
            access_token=token,
            expires_in=self.settings.jwt_access_token_expire_minutes * 60,
        )

    async def get_current_user(self, user_id: str) -> User | None:
        return await self.repo.get_by_id(user_id)
