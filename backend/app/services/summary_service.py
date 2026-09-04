import uuid
from dataclasses import asdict

from fastapi import status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.crud.summary import get_summary_by_meeting_id, update_action_item, upsert_summary
from app.crud.transcript import get_transcript_by_meeting_id
from app.models.summary import Summary
from app.models.transcript import Transcript
from app.schemas.summary import SummaryActionItemUpdate
from app.services.ai.base import StructuredSummaryResult
from app.services.ai.factory import get_summary_ai_provider


def run_summary_ai(transcript: Transcript) -> StructuredSummaryResult:
    """The AI-provider half of Summary generation: no DB writes, so it's
    safe to call from a concurrent context (e.g. alongside Timeline
    generation — see `pipeline_service`) as long as each caller persists its
    own result afterward on the shared `Session`, never during this call.
    Raises `AppError` on a provider error or an unusable (empty) result —
    same validation `generate_summary` has always done, just split out so it
    can run standalone.

    Passes `settings.ai_output_language` (default "English") as the output
    language, never `transcript.language` — the latter is Whisper's detected
    *spoken* language and must stay out of this call. Feeding it in here was
    the root cause of Summary/Meeting Notes coming back in Hindi for a Hindi
    (or Hindi-detected-majority mixed) meeting: `generate_structured_summary`
    treats its `language` kwarg as an instruction for what language to
    *write* the summary in, not a description of the transcript, so passing
    the detected speech language told the provider to write the summary in
    that language instead of English. The transcript itself is untouched —
    this only changes the language of newly generated summary text.
    """
    source_text = transcript.normalized_transcript or transcript.transcript
    try:
        result = get_summary_ai_provider().generate_structured_summary(
            source_text, language=get_settings().ai_output_language
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
    return result


def persist_summary_result(
    db: Session, *, meeting_id: uuid.UUID, result: StructuredSummaryResult
) -> Summary:
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

    result = run_summary_ai(transcript)
    return persist_summary_result(db, meeting_id=meeting_id, result=result)


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
