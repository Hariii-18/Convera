"""Emails the current saved Meeting Notes to one or more recipients.

Reuses `export_meeting_notes` (see `app.services.export.export_service`) for
the attachment — the exact same render used by the download endpoint — so
there is exactly one place that turns a `MeetingNotes` row into PDF/DOCX/PPTX
bytes. This module only resolves recipients and adds the subject/body,
handing the result to the email provider; it never touches Transcript,
Summary, or MeetingNotes data itself.
"""

import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.user import User
from app.schemas.meeting_notes import MAX_MEETING_NOTES_EMAIL_RECIPIENTS
from app.services.email.resend_provider import send_email_with_attachment
from app.services.export.export_service import export_meeting_notes
from app.services.meeting_notes_service import get_meeting_notes


def resolve_email_recipients(
    own_email: str, send_to_me: bool, recipients: list[str]
) -> list[str]:
    """Merges `own_email` (when `send_to_me`) with `recipients` into the
    final send list: whitespace-trimmed and deduplicated case-insensitively
    (first-seen casing wins, after trimming). Raises a 422 `AppError` if the
    result is empty or exceeds `MAX_MEETING_NOTES_EMAIL_RECIPIENTS`.

    Trims independently of `MeetingNotesEmailRequest`'s own trimming
    validator so this stays correct for any caller, not just the API route.
    """
    ordered = ([own_email] if send_to_me else []) + [r.strip() for r in recipients]

    seen: set[str] = set()
    deduped: list[str] = []
    for address in ordered:
        key = address.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(address)

    if not deduped:
        raise AppError(
            "At least one recipient is required",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    if len(deduped) > MAX_MEETING_NOTES_EMAIL_RECIPIENTS:
        raise AppError(
            f"Too many recipients: at most {MAX_MEETING_NOTES_EMAIL_RECIPIENTS} allowed",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return deduped


def send_meeting_notes_email(
    db: Session,
    meeting_id: uuid.UUID,
    user: User,
    export_format: str,
    send_to_me: bool,
    recipients: list[str],
) -> list[str]:
    """Renders `meeting_id`'s saved Meeting Notes to `export_format` and
    emails it to every resolved recipient in a single provider call. Returns
    the final recipient list.

    Ownership is enforced the same way as every other Meeting Notes read/
    export: `get_meeting_notes`/`export_meeting_notes` raise a 404 `AppError`
    for a meeting `user` doesn't own, before any recipient is resolved or any
    email is sent.
    """
    notes = get_meeting_notes(db, meeting_id, user.id)
    to_addresses = resolve_email_recipients(user.email, send_to_me, recipients)
    content, filename, _content_type = export_meeting_notes(
        db, meeting_id, user.id, export_format
    )

    subject = f"Meeting Notes: {notes.title}"
    body = (
        f'Attached are the meeting notes for "{notes.title}" in '
        f"{export_format.upper()} format.\n\n"
        "— Converra"
    )

    # A send may reach several independent recipients — none of them should
    # see who else received it. The first address is the visible `to`;
    # everyone else rides along in `bcc`, which Resend never discloses to
    # any recipient (see `send_email_with_attachment`).
    primary, *rest = to_addresses
    send_email_with_attachment(
        to=primary,
        bcc=rest or None,
        subject=subject,
        text_body=body,
        attachment_content=content,
        attachment_filename=filename,
    )
    return to_addresses
