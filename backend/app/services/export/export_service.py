"""Meeting Notes export: one saved `MeetingNotes` row, three renderers.

    MeetingNotes -> build_export_document() -> ExportDocument
                                                     |
                                     +---------------+---------------+
                                     |               |               |
                                 PdfExporter    DocxExporter    PptxExporter

`build_export_document` (see `content.py`) is the only place that decides
what content goes into an export; the three exporters only decide how to
render it, so there is exactly one data-building pipeline, not three.
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
from app.crud.summary import get_summary_by_meeting_id
from app.schemas.summary import SummaryRead
from app.services.export.base import Exporter
from app.services.export.content import build_export_document, build_summary_export_document
from app.services.export.docx_exporter import DocxExporter
from app.services.export.pdf_exporter import PdfExporter
from app.services.export.pptx_exporter import PptxExporter
from app.services.meeting_notes_service import get_meeting_notes

ExportFormat = Literal["pdf", "docx", "pptx"]

# Presentation-only formatting, same zone `meeting_notes_service` renders
# `date_time_ist` in - Summary export has no persisted "notes" row to read
# a pre-formatted string from, so it's derived fresh here.
_PRESENTATION_TIMEZONE = ZoneInfo("Asia/Kolkata")

_EXPORTERS: dict[str, Exporter] = {
    "pdf": PdfExporter(),
    "docx": DocxExporter(),
    "pptx": PptxExporter(),
}


def _safe_filename(title: str, extension: str, *, kind: str = "notes") -> str:
    """ASCII-only slug so the value is always safe inside a `Content-Disposition`
    header (no quotes, no newlines, no non-ASCII that would need RFC 5987
    encoding) - derived from the meeting title but never echoes it verbatim.
    """
    normalized = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    if not slug:
        slug = "meeting-notes" if kind == "notes" else f"meeting-{kind}"
    return f"converra-{slug}-{kind}.{extension}"


def export_meeting_notes(
    db: Session, meeting_id: uuid.UUID, user_id: int, export_format: str
) -> tuple[bytes, str, str]:
    """Renders `meeting_id`'s saved Meeting Notes to `export_format`.

    Returns `(content, filename, content_type)`. Sources content exclusively
    from `get_meeting_notes` (the same read used by the GET endpoint and the
    UI) - never a fresh AI re-derivation - so a download always matches
    whatever is currently saved, edits included. Ownership is enforced by
    `get_meeting_notes` itself (raises 404 for a meeting the caller doesn't
    own, same as every other Meeting Notes read).
    """
    exporter = _EXPORTERS.get(export_format)
    if exporter is None:
        raise AppError(f"Unsupported export format: {export_format}", status.HTTP_400_BAD_REQUEST)

    notes = get_meeting_notes(db, meeting_id, user_id)
    document = build_export_document(notes)
    content = exporter.render(document)
    filename = _safe_filename(notes.title, exporter.file_extension)
    return content, filename, exporter.content_type


def export_summary(
    db: Session, meeting_id: uuid.UUID, user_id: int, export_format: str
) -> tuple[bytes, str, str]:
    """Renders `meeting_id`'s saved Summary tab content to `export_format`.

    Sources content from the `Summary` row directly (not through Meeting
    Notes) so the download always matches exactly what's on screen in the
    Summary tab, and stays available even before Meeting Notes' own
    transcript-readiness gate is satisfied. Ownership is enforced via
    `get_meeting` (raises 404 for a meeting the caller doesn't own).
    """
    exporter = _EXPORTERS.get(export_format)
    if exporter is None:
        raise AppError(f"Unsupported export format: {export_format}", status.HTTP_400_BAD_REQUEST)

    meeting = get_meeting(db, meeting_id, user_id)
    if meeting is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    summary = get_summary_by_meeting_id(db, meeting_id)
    if summary is None:
        raise AppError("Summary not ready", status.HTTP_404_NOT_FOUND)

    date_time_ist = meeting.created_at.astimezone(_PRESENTATION_TIMEZONE).strftime(
        "%Y-%m-%d %H:%M:%S %Z"
    )
    document = build_summary_export_document(
        SummaryRead.model_validate(summary),
        meeting.title,
        date_time_ist,
        meeting.duration_seconds,
        meeting.participants_count,
    )
    content = exporter.render(document)
    filename = _safe_filename(meeting.title, exporter.file_extension, kind="summary")
    return content, filename, exporter.content_type
