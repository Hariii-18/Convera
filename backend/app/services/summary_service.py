import uuid
from dataclasses import asdict

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.summary import upsert_summary
from app.crud.transcript import get_transcript_by_meeting_id
from app.models.summary import Summary
from app.services.ai.factory import get_ai_provider


def generate_summary(db: Session, meeting_id: uuid.UUID) -> Summary:
    """Runs the Local Summary Engine for a meeting: reads its transcript, asks
    the configured `AIProvider` (Ollama, locally) for a sectioned summary, and
    upserts the result.
    """
    transcript = get_transcript_by_meeting_id(db, meeting_id)
    if transcript is None:
        raise AppError("Transcript not found", status.HTTP_404_NOT_FOUND)

    result = get_ai_provider().generate_structured_summary(
        transcript.transcript, language=transcript.language
    )

    return upsert_summary(
        db,
        meeting_id=meeting_id,
        executive_summary=result.executive_summary,
        topics=[asdict(topic) for topic in result.topics],
        decisions=[asdict(decision) for decision in result.decisions],
        action_items=[asdict(item) for item in result.action_items],
        risks=[asdict(risk) for risk in result.risks],
        open_questions=[asdict(question) for question in result.open_questions],
        next_steps=[asdict(step) for step in result.next_steps],
    )
