from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.routes import api_router
from app.core.config import configure_logging, get_settings
from app.core.rate_limit import RateLimitMiddleware
from app.core.exceptions import AppException
from app.models.base import create_tables, engine

logger = structlog.get_logger()


# ── Request ID Middleware ──
# Every request gets a unique ID for tracing through logs, error reports, etc.


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # noqa: ANN001
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        # Bind to structlog context so every log line in this request includes it
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# ── Lifespan ──


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    configure_logging()
    logger.info("app_starting", app=settings.app_name, env=settings.app_env, debug=settings.debug)

    if not settings.is_production:
        await create_tables()
        logger.info("database_tables_created")

    yield

    await engine.dispose()
    logger.info("app_shutdown")


# ── App Factory ──


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Geply",
        description="AI-Powered Interview Platform by GEP",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # ── Middleware (order matters — first added = outermost) ──
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(RateLimitMiddleware)

    # CORS — production uses explicit origins from env; dev uses localhost defaults
    allowed_methods = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    allowed_headers = ["Authorization", "Content-Type", "X-Request-ID"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=allowed_methods,
        allow_headers=allowed_headers,
    )

    # ── Exception Handlers ──

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        logger.warning(
            "app_exception",
            code=exc.code,
            message=exc.message,
            status=exc.status,
            path=request.url.path,
        )
        return JSONResponse(
            status_code=exc.status,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "context": exc.context,
                }
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "unhandled_exception",
            error=str(exc),
            error_type=type(exc).__name__,
            path=request.url.path,
            method=request.method,
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "context": {},
                }
            },
        )

    # ── Routes ──
    app.include_router(api_router)
    from app.api.routes.interview_session import router as interview_session_router
    app.include_router(interview_session_router, prefix="/api/v1")

    # ── Password Reset Routes ──
    from app.api.routes.password_reset import router as password_reset_router
    app.include_router(password_reset_router)

    @app.get("/health")
    async def health() -> dict:
        return {"status": "healthy", "service": "geply", "version": "1.0.0"}

    return app


app = create_app()
