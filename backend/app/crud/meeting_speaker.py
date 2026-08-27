import uuid

from sqlalchemy.orm import Session

from app.models.meeting_speaker import MeetingSpeaker
from app.schemas.meeting_speaker import MeetingSpeakerUpdate


def list_speakers_by_meeting(db: Session, meeting_id: uuid.UUID) -> list[MeetingSpeaker]:
    return (
        db.query(MeetingSpeaker)
        .filter(MeetingSpeaker.meeting_id == meeting_id)
        .order_by(MeetingSpeaker.created_at.asc())
        .all()
    )


def get_speaker_for_meeting(
    db: Session, speaker_id: uuid.UUID, meeting_id: uuid.UUID
) -> MeetingSpeaker | None:
    """Scoped to `meeting_id` as well as `speaker_id` so a speaker from a
    meeting the caller doesn't own (or a different meeting entirely) can
    never be read, updated, or deleted through this lookup — see
    `meeting_speaker_service` for the ownership check on `meeting_id` itself.
    """
    return (
        db.query(MeetingSpeaker)
        .filter(MeetingSpeaker.id == speaker_id, MeetingSpeaker.meeting_id == meeting_id)
        .first()
    )


def create_speaker(
    db: Session,
    *,
    meeting_id: uuid.UUID,
    speaker_key: str,
    display_name: str,
    role: str | None,
    company: str | None,
    notes: str | None,
) -> MeetingSpeaker:
    speaker = MeetingSpeaker(
        meeting_id=meeting_id,
        speaker_key=speaker_key,
        display_name=display_name,
        role=role,
        company=company,
        notes=notes,
    )
    db.add(speaker)
    db.commit()
    db.refresh(speaker)
    return speaker


# `display_name` is excluded here (handled separately in `update_speaker`)
# since it's NOT NULL on the model — an explicit `null` in the request body
# must not be written through.
_UPDATABLE_FIELDS = ("role", "company", "notes")


def update_speaker(
    db: Session, speaker: MeetingSpeaker, speaker_in: MeetingSpeakerUpdate
) -> MeetingSpeaker:
    data = speaker_in.model_dump(exclude_unset=True)
    for field in _UPDATABLE_FIELDS:
        if field in data:
            setattr(speaker, field, data[field])
    if data.get("display_name"):
        speaker.display_name = data["display_name"]
    db.commit()
    db.refresh(speaker)
    return speaker


def delete_speaker(db: Session, speaker: MeetingSpeaker) -> None:
    db.delete(speaker)
    db.commit()
