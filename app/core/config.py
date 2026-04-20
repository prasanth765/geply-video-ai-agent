from __future__ import annotations

import logging
import sys
from functools import lru_cache
from typing import Self

import structlog
from pydantic import model_validator
from pydantic_settings import BaseSettings

# â”€â”€ Sentinel for detecting unchanged defaults â”€â”€
_DEFAULT_JWT_SECRET = "geply-dev-secret-key-change-in-prod-2024"


class Settings(BaseSettings):
    # â”€â”€ App â”€â”€
    app_name: str = "geply"
    app_env: str = "development"
    debug: bool = True
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    frontend_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"

    # â”€â”€ Database (SQLite by default â€” zero setup) â”€â”€
    database_url: str = "sqlite+aiosqlite:///./geply.db"
    database_pool_size: int = 5
    database_max_overflow: int = 10

    # â”€â”€ Redis (optional â€” leave empty to skip) â”€â”€
    redis_url: str = ""
    celery_broker_url: str = ""

    # â”€â”€ JWT â”€â”€
    jwt_secret: str = _DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_invite_token_expire_hours: int = 72

    # â”€â”€ LiveKit â”€â”€
    livekit_url: str = "ws://localhost:7880"
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # â”€â”€ Storage â”€â”€
    storage_backend: str = "local"
    storage_local_path: str = "./uploads"
    minio_endpoint: str = ""
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_bucket: str = "geply-recordings"
    minio_secure: bool = False

    # â”€â”€ n8n â”€â”€
    n8n_base_url: str = "http://localhost:5678"
    n8n_webhook_email_invite: str = "/webhook/email-invite"
    n8n_webhook_report_ready: str = "/webhook/report-ready"

    # â”€â”€ LLM â”€â”€
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_api_key: str = ""
    llm_model: str = "llama-3.1-8b-instant"
    llm_max_tokens: int = 2048

    # â”€â”€ CORS â”€â”€
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # â”€â”€ Rate Limiting â”€â”€
    rate_limit_per_minute: int = 60

    # Email (Resend) -- leave empty for dev mode (link logs to console)
    resend_api_key: str = ""
    email_from: str = "Geply <onboarding@resend.dev>"
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @model_validator(mode="after")
    def _validate_production_safety(self) -> Self:
        """Crash fast if production config is dangerous."""
        if self.is_production:
            if self.jwt_secret == _DEFAULT_JWT_SECRET:
                raise ValueError(
                    "FATAL: JWT_SECRET must be changed from default before running in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )
            if self.debug:
                raise ValueError("FATAL: DEBUG must be False in production (set APP_ENV=production, DEBUG=false)")
            if "*" in self.cors_origins or "http://localhost:5173" in self.cors_origins:
                raise ValueError("FATAL: CORS_ORIGINS must not contain localhost or wildcard in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


def configure_logging() -> None:
    """Set up structlog with JSON output for production, pretty-print for dev."""
    settings = get_settings()

    log_level = logging.DEBUG if settings.debug else logging.INFO

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.is_production:
        # JSON lines for log aggregation (ELK, Datadog, etc.)
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        # Pretty console output for development
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Quiet noisy third-party loggers
    for name in ("uvicorn.access", "sqlalchemy.engine", "sqlalchemy.pool", "aiosqlite", "httpx"):
        logging.getLogger(name).setLevel(logging.WARNING)
