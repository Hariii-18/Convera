from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.live_meetings import router as live_meetings_router
from app.api.v1.meeting_notes import router as meeting_notes_router
from app.api.v1.meeting_speakers import router as meeting_speakers_router
from app.api.v1.meetings import router as meetings_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.processing import router as processing_router
from app.api.v1.summaries import router as summaries_router
from app.api.v1.transcripts import router as transcripts_router
from app.api.v1.uploads import router as uploads_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(meetings_router)
api_router.include_router(live_meetings_router)
api_router.include_router(uploads_router)
api_router.include_router(processing_router)
api_router.include_router(transcripts_router)
api_router.include_router(summaries_router)
api_router.include_router(meeting_notes_router)
api_router.include_router(meeting_speakers_router)
api_router.include_router(dashboard_router)
api_router.include_router(notifications_router)
