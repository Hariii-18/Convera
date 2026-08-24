"""Emails the current saved Meeting Notes to the requesting user.

Reuses `export_meeting_notes` (see `app.services.export.export_service`) for
the attachment — the exact same render used by the download endpoint — so
there is exactly one place that turns a `MeetingNotes` row into PDF/DOCX/PPTX
bytes. This module only adds the recipient/subject/body and hands the result
to the email provider; it never touches Transcript, Summary, or MeetingNotes
data itself.
"""

import uuid

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.email.resend_provider import send_email_with_attachment
from app.services.export.export_service import export_meeting_notes
from app.services.meeting_notes_service import get_meeting_notes


def send_meeting_notes_email(
    db: Session, meeting_id: uuid.UUID, user: User, export_format: str
) -> str:
    """Renders `meeting_id`'s saved Meeting Notes to `export_format` and
    emails it to `user.email`. Returns the recipient address.

    Ownership is enforced the same way as every other Meeting Notes read/
    export: `get_meeting_notes`/`export_meeting_notes` raise a 404 `AppError`
    for a meeting `user` doesn't own, before any email is sent.
    """
    notes = get_meeting_notes(db, meeting_id, user.id)
    content, filename, _content_type = export_meeting_notes(
        db, meeting_id, user.id, export_format
    )

    subject = f"Meeting Notes: {notes.title}"
    body = (
        f"Hi {user.full_name},\n\n"
        f'Attached are the meeting notes for "{notes.title}" in '
        f"{export_format.upper()} format.\n\n"
        "— Converra"
    )

    send_email_with_attachment(
        to=user.email,
        subject=subject,
        text_body=body,
        attachment_content=content,
        attachment_filename=filename,
    )
    return user.email
