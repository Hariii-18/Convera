"""Thin wrapper around the Resend (https://resend.com) transactional email
API. This is the only place that talks to the email provider — callers (see
`app.services.meeting_notes_email_service`) hand it a recipient, subject,
body, and a pre-rendered attachment, and never touch the HTTP call directly.
Swapping providers later only means rewriting this module.
"""

import base64

import httpx
from fastapi import status

from app.core.config import get_settings
from app.core.exceptions import AppError

_RESEND_API_URL = "https://api.resend.com/emails"


def send_email_with_attachment(
    *,
    to: str,
    subject: str,
    text_body: str,
    attachment_content: bytes,
    attachment_filename: str,
    bcc: list[str] | None = None,
) -> None:
    """Sends a single email with one attachment via Resend, optionally BCCing
    additional recipients.

    `bcc` exists so multi-recipient sends (see
    `app.services.meeting_notes_email_service`) can go out as one provider
    call without recipients seeing each other's address — Resend never
    discloses `bcc` addresses to `to` or to other `bcc` recipients.

    Raises `AppError` (502) for anything that keeps the email from being
    sent — missing configuration, a network failure, or a non-2xx response
    from Resend — so callers can surface a clear failure without ever
    touching Transcript/Summary/MeetingNotes state.
    """
    settings = get_settings()
    if not settings.resend_api_key or not settings.resend_from_email:
        raise AppError(
            "Email delivery is not configured on the server",
            status.HTTP_502_BAD_GATEWAY,
        )

    payload = {
        "from": settings.resend_from_email,
        "to": [to],
        "subject": subject,
        "text": text_body,
        "attachments": [
            {
                "filename": attachment_filename,
                "content": base64.b64encode(attachment_content).decode("ascii"),
            }
        ],
    }
    if bcc:
        payload["bcc"] = bcc

    try:
        response = httpx.post(
            _RESEND_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=settings.resend_request_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise AppError(
            "Failed to send email: email provider unreachable",
            status.HTTP_502_BAD_GATEWAY,
        ) from exc

    if response.status_code >= 400:
        raise AppError(
            f"Failed to send email: provider returned {response.status_code}",
            status.HTTP_502_BAD_GATEWAY,
        )
