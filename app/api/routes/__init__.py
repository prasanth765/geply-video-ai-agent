from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.candidates import router as candidates_router
from app.api.routes.interviews import router as interviews_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.reports import router as reports_router
from app.api.routes.schedules import router as schedules_router
from app.api.routes.webhooks import router as webhooks_router
from app.api.routes.internal import router as internal_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(jobs_router)
api_router.include_router(candidates_router)
api_router.include_router(interviews_router)
api_router.include_router(schedules_router)
api_router.include_router(reports_router)
api_router.include_router(notifications_router)
api_router.include_router(webhooks_router)
api_router.include_router(internal_router)
