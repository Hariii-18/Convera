"""Emails the current Conversation export (the transcript rendered as
speaker-labeled dialogue) to one or more recipients.

Reuses `export_conversation` (see
`app.services.export.conversation_export_service`) for the attachment — the
exact same render used by the Conversation tab's download button, sourced
fresh from the current transcript and current `MeetingSpeaker` names on
every call — and `resolve_email_recipients` from
`app.services.meeting_notes_email_service` for the merge/trim/dedup/max-10/
BCC-privacy rules Meeting Notes email already established, so both flows
share one recipient-resolution policy. This module only resolves the
meeting title for the subject/body and hands the rendered attachment to the
email provider; it never touches Transcript or MeetingSpeaker data itself.
"""

import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.models.user import User
from app.services.email.resend_provider import send_email_with_attachment
from app.services.export.conversation_export_service import export_conversation
from app.services.meeting_notes_email_service import resolve_email_recipients


def send_conversation_email(
    db: Session,
    meeting_id: uuid.UUID,
    user: User,
    export_format: str,
    send_to_me: bool,
    recipients: list[str],
) -> list[str]:
    """Renders `meeting_id`'s Conversation view to `export_format` and emails
    it to every resolved recipient in a single provider call. Returns the
    final recipient list.

    Ownership is enforced the same way as every other Conversation read/
    export: a meeting `user` doesn't own raises a 404 `AppError` here (via
    `get_meeting`) before any recipient is resolved, and again in
    `export_conversation` before anything is rendered.
    """
    meeting = get_meeting(db, meeting_id, user.id)
    if meeting is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    to_addresses = resolve_email_recipients(user.email, send_to_me, recipients)
    content, filename, _content_type = export_conversation(
        db, meeting_id, user.id, export_format
    )

    subject = f"Conversation Transcript: {meeting.title}"
    body = (
        f'Attached is the conversation transcript for "{meeting.title}" in '
        f"{export_format.upper()} format.\n\n"
        "— Converra"
    )

    # See `meeting_notes_email_service.send_meeting_notes_email` — the first
    # address is the visible `to`, everyone else rides along in `bcc` so no
    # recipient sees who else received it.
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
