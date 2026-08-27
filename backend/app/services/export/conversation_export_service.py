"""Conversation export: a meeting's transcript rendered as speaker-labeled
dialogue, PDF/DOCX.

    Transcript -> build_conversation_export_document() -> ConversationExportDocument
                                                                 |
                                                     +-----------+-----------+
                                                     |                       |
                                        ConversationPdfExporter   ConversationDocxExporter

Sources segments and speaker names through exactly the same read path as
the Conversation tab and the Transcript tab's default ("raw") view —
`Transcript.segments` resolved via `app.services.speaker_resolution` — so a
download always matches what's on screen, and a rename in the Speakers
panel is reflected immediately (resolved fresh on every read, nothing
persisted). Never touches `Transcript.segments` itself, and shares no code
path with `app.services.export.export_service` (Meeting Notes export), so
Meeting Notes exports are unaffected by this module either way.
"""

import re
import unicodedata
import uuid
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.crud.transcript import get_transcript_by_meeting_id
from app.services.export.base import Exporter
from app.services.export.conversation_content import build_conversation_export_document
from app.services.export.conversation_docx_exporter import ConversationDocxExporter
from app.services.export.conversation_pdf_exporter import ConversationPdfExporter
from app.services.speaker_resolution import build_speaker_name_map, resolve_segments

ConversationExportFormat = Literal["pdf", "docx"]

_PRESENTATION_TIMEZONE = ZoneInfo("Asia/Kolkata")

_EXPORTERS: dict[str, Exporter] = {
    "pdf": ConversationPdfExporter(),
    "docx": ConversationDocxExporter(),
}


def _safe_filename(title: str, extension: str) -> str:
    """Mirrors `export_service._safe_filename` — ASCII-only slug, safe
    inside a `Content-Disposition` header.
    """
    normalized = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    if not slug:
        slug = "conversation"
    return f"converra-{slug}-conversation.{extension}"


def export_conversation(
    db: Session, meeting_id: uuid.UUID, user_id: int, export_format: str
) -> tuple[bytes, str, str]:
    """Renders `meeting_id`'s transcript as speaker dialogue to `export_format`.

    Returns `(content, filename, content_type)`. Ownership is enforced here
    directly (`get_meeting` filters by `user_id`, same as every other
    meeting-scoped read) — a meeting the caller doesn't own 404s exactly
    like a nonexistent one.
    """
    exporter = _EXPORTERS.get(export_format)
    if exporter is None:
        raise AppError(f"Unsupported export format: {export_format}", status.HTTP_400_BAD_REQUEST)

    meeting = get_meeting(db, meeting_id, user_id)
    if meeting is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    transcript = get_transcript_by_meeting_id(db, meeting_id)
    if transcript is None:
        raise AppError("Transcript not found", status.HTTP_404_NOT_FOUND)

    duration_seconds = meeting.duration_seconds
    if duration_seconds is None and transcript.duration is not None:
        duration_seconds = round(transcript.duration)

    name_map = build_speaker_name_map(db, meeting_id)
    segments = resolve_segments(transcript.segments, name_map)

    document = build_conversation_export_document(
        meeting_title=meeting.title,
        date_time_ist=meeting.created_at.astimezone(_PRESENTATION_TIMEZONE).strftime(
            "%Y-%m-%d %H:%M:%S %Z"
        ),
        duration_seconds=duration_seconds,
        participants_count=meeting.participants_count,
        segments=segments,
    )
    content = exporter.render(document)
    filename = _safe_filename(meeting.title, exporter.file_extension)
    return content, filename, exporter.content_type
