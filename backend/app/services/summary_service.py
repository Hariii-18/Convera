import uuid
from dataclasses import asdict

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.crud.summary import get_summary_by_meeting_id, update_action_item, upsert_summary
from app.crud.transcript import get_transcript_by_meeting_id
from app.models.summary import Summary
from app.schemas.summary import SummaryActionItemUpdate
from app.services.ai.factory import get_summary_ai_provider


def generate_summary(db: Session, meeting_id: uuid.UUID) -> Summary:
    """Runs the Summary Engine for a meeting: reads its transcript (the
    normalized transcript when one has already been generated, otherwise the
    raw one), asks the configured Summary `AIProvider` (OpenAI by default —
    see `app.services.ai.factory.get_summary_ai_provider`) for a sectioned
    summary, and upserts the result.
    """
    transcript = get_transcript_by_meeting_id(db, meeting_id)
    if transcript is None:
        raise AppError("Transcript not found", status.HTTP_404_NOT_FOUND)

    source_text = transcript.normalized_transcript or transcript.transcript

    try:
        result = get_summary_ai_provider().generate_structured_summary(
            source_text, language=transcript.language
        )
    except AppError:
        raise
    except Exception as exc:
        raise AppError(
            f"Summary generation failed: the AI provider is unavailable or returned an error ({exc}).",
            status.HTTP_502_BAD_GATEWAY,
        ) from exc

    if not result.executive_summary.strip():
        # The provider returned a response it couldn't parse into a summary
        # (see `generate_structured_summary`'s empty-result fallback on each
        # provider) — treat that the same as a provider error rather than
        # persisting an empty "successful" summary.
        raise AppError(
            "Summary generation failed: the AI provider returned no usable summary.",
            status.HTTP_502_BAD_GATEWAY,
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


def update_summary_action_item(
    db: Session,
    meeting_id: uuid.UUID,
    user_id: int,
    index: int,
    payload: SummaryActionItemUpdate,
) -> Summary:
    """Ownership-checked partial edit of one `Summary.action_items` entry
    (status/owner/due_date/text). Never touches `executive_summary`/`topics`/
    `decisions`/.../`timeline_events` on the row, the transcript, Meeting
    Notes, or the AI generation path — this only ever reaches
    `crud.summary.update_action_item`, a plain field assignment.
    """
    if get_meeting(db, meeting_id, user_id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    summary = get_summary_by_meeting_id(db, meeting_id)
    if summary is None:
        raise AppError("Summary not found", status.HTTP_404_NOT_FOUND)

    updated = update_action_item(
        db, summary, index, payload.model_dump(exclude_unset=True)
    )
    if updated is None:
        raise AppError("Action item not found", status.HTTP_404_NOT_FOUND)
    return updated
