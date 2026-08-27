import uuid

from sqlalchemy.orm import Session

from app.models.meeting_notes import MeetingNotes
from app.schemas.meeting_notes import MeetingNotesUpdate


def get_meeting_notes_by_meeting_id(db: Session, meeting_id: uuid.UUID) -> MeetingNotes | None:
    return db.query(MeetingNotes).filter(MeetingNotes.meeting_id == meeting_id).first()


def create_meeting_notes(
    db: Session,
    *,
    meeting_id: uuid.UUID,
    title: str,
    executive_summary: str,
    discussion_topics: list[dict],
    decisions: list[dict],
    action_items: list[dict],
    risks: list[dict],
    open_questions: list[dict],
    next_steps: list[dict],
    timestamped_discussion: list[dict],
) -> MeetingNotes:
    """Creates the (single) MeetingNotes row for a meeting.

    Callers must check `get_meeting_notes_by_meeting_id` first — a meeting
    has at most one MeetingNotes row, and this does not upsert (see
    `meeting_notes_service.ensure_meeting_notes` for why re-creating on top
    of an existing row would clobber a user's edits).
    """
    record = MeetingNotes(
        meeting_id=meeting_id,
        title=title,
        executive_summary=executive_summary,
        discussion_topics=discussion_topics,
        decisions=decisions,
        action_items=action_items,
        risks=risks,
        open_questions=open_questions,
        next_steps=next_steps,
        timestamped_discussion=timestamped_discussion,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


_UPDATABLE_FIELDS = (
    "title",
    "executive_summary",
    "discussion_topics",
    "decisions",
    "action_items",
    "risks",
    "open_questions",
    "next_steps",
    "timestamped_discussion",
)


def _restore_speaker_keys(existing: list[dict], incoming: list[dict]) -> list[dict]:
    """`MeetingNotesUpdate.timestamped_discussion` round-trips only
    `start`/`end`/`text` (see `EditableDetailedDiscussion` on the frontend,
    which never reads or writes `speaker_key`), so saving an edit would
    otherwise silently drop the diarization-assigned `speaker_key` off every
    segment. Restores each segment's `speaker_key` from the row already
    stored at the same index instead — segment order/count is preserved by
    the editor (only `text` changes) — and never invents one for a segment
    that didn't have it. `speaker_name` is never stored either way; it's
    resolved fresh from `MeetingSpeaker` on every read (see
    `meeting_notes_service._to_read`).
    """
    merged = []
    for index, segment in enumerate(incoming):
        speaker_key = segment.get("speaker_key")
        if speaker_key is None and index < len(existing):
            speaker_key = existing[index].get("speaker_key")
        merged.append({**segment, "speaker_key": speaker_key})
    return merged


def update_meeting_notes(
    db: Session, notes: MeetingNotes, notes_in: MeetingNotesUpdate
) -> MeetingNotes:
    """Applies only the fields present in `notes_in` (partial update). Never
    touches `Transcript` or `Summary` — those aren't reachable from here.
    """
    data = notes_in.model_dump(exclude_unset=True)
    for field in _UPDATABLE_FIELDS:
        if field in data:
            value = data[field]
            if field == "timestamped_discussion":
                value = _restore_speaker_keys(notes.timestamped_discussion, value)
            setattr(notes, field, value)
    db.commit()
    db.refresh(notes)
    return notes
