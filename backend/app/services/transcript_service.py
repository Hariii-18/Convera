"""Ownership-checked read of a meeting's Transcript, with every segment's
`speaker_key` resolved to a presentation `speaker_name` (Speaker System Part
5 — see `app.services.speaker_resolution`). Mirrors
`meeting_notes_service.get_meeting_notes`'s shape: the API route calls one
service function, ownership-checked, and gets back the already-resolved
read schema — `Transcript.segments`/`normalized_segments`/`translated_segments`
themselves are never touched.
"""

import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.crud.transcript import get_transcript_by_meeting_id, update_transcript_segments
from app.models.transcript import Transcript
from app.schemas.transcript import TranscriptRead, TranscriptUpdate
from app.services.speaker_resolution import build_speaker_name_map, resolve_segments


def to_transcript_read(db: Session, transcript: Transcript) -> TranscriptRead:
    """Resolves `transcript`'s segments against its meeting's current
    `MeetingSpeaker` rows. Takes an already-fetched, already ownership-checked
    `Transcript` so `normalize`/`translate` (which each produce a fresh
    `Transcript` of their own) can reuse this without a second meeting lookup.
    """
    name_map = build_speaker_name_map(db, transcript.meeting_id)
    return TranscriptRead(
        id=transcript.id,
        meeting_id=transcript.meeting_id,
        upload_id=transcript.upload_id,
        language=transcript.language,
        transcript=transcript.transcript,
        segments=resolve_segments(transcript.segments, name_map),
        duration=transcript.duration,
        word_count=transcript.word_count,
        normalized_transcript=transcript.normalized_transcript,
        normalized_segments=(
            resolve_segments(transcript.normalized_segments, name_map)
            if transcript.normalized_segments is not None
            else None
        ),
        normalized_at=transcript.normalized_at,
        translated_transcript=transcript.translated_transcript,
        translated_segments=(
            resolve_segments(transcript.translated_segments, name_map)
            if transcript.translated_segments is not None
            else None
        ),
        translated_language=transcript.translated_language,
        translated_at=transcript.translated_at,
        created_at=transcript.created_at,
        updated_at=transcript.updated_at,
    )


def get_transcript(db: Session, meeting_id: uuid.UUID, user_id: int) -> TranscriptRead:
    if get_meeting(db, meeting_id, user_id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    transcript = get_transcript_by_meeting_id(db, meeting_id)
    if transcript is None:
        raise AppError("Transcript not found", status.HTTP_404_NOT_FOUND)

    return to_transcript_read(db, transcript)


def update_transcript(
    db: Session, meeting_id: uuid.UUID, user_id: int, update: TranscriptUpdate
) -> TranscriptRead:
    """Ownership-checked persistence of a user's edits to the raw transcript's
    segment text. Mirrors `meeting_notes_service.update_meeting_notes`'s
    shape: ownership check, then a single CRUD call, then the same
    already-resolved read schema `get_transcript` returns, so a save and a
    reload produce identical shapes.
    """
    if get_meeting(db, meeting_id, user_id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    transcript = get_transcript_by_meeting_id(db, meeting_id)
    if transcript is None:
        raise AppError("Transcript not found", status.HTTP_404_NOT_FOUND)

    try:
        transcript = update_transcript_segments(
            db,
            transcript,
            edited_segments=[segment.model_dump() for segment in update.segments],
        )
    except ValueError as error:
        raise AppError(str(error), status.HTTP_400_BAD_REQUEST) from error

    return to_transcript_read(db, transcript)
