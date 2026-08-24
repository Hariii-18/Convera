"""Verify Meeting Notes Email Delivery end-to-end against the real DB.

Reuses the same throwaway user/meeting/upload setup as
`scripts.verify_meeting_notes`, then exercises `send_meeting_notes_email`
directly (no real network call to Resend — `httpx.post` is monkeypatched so
this runs without credentials or network access).

Checks:
  A. Unconfigured provider (no RESEND_API_KEY) raises a 502 AppError, and
     leaves MeetingNotes/Transcript/Summary untouched.
  B. A successful send calls the provider with the CURRENT saved
     MeetingNotes rendered to the requested format, addressed to the
     requesting user's own email, subject includes the meeting title, and
     leaves MeetingNotes/Transcript/Summary untouched.
  C. A provider failure (non-2xx response) raises a 502 AppError and leaves
     MeetingNotes/Transcript/Summary untouched.
  D. A second user cannot email the first user's meeting notes (404).

Usage: python -m scripts.verify_meeting_notes_email
"""

import sys
import uuid

import httpx

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.crud.meeting import create_meeting
from app.crud.summary import get_summary_by_meeting_id
from app.crud.transcript import get_transcript_by_meeting_id, upsert_transcript
from app.crud.upload import create_upload
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.meeting_notes import MeetingNotes
from app.models.summary import Summary
from app.models.transcript import Transcript
from app.models.upload import Upload
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.services.ai.base import ActionItem, StructuredSummaryResult, SummaryTextItem
from app.services.meeting_notes_email_service import send_meeting_notes_email
from app.services.meeting_notes_service import get_meeting_notes
from app.services.pipeline_service import run_post_transcription_pipeline

PRIMARY_EMAIL = "verify-meeting-notes-email@convera.test"
OTHER_EMAIL = "verify-meeting-notes-email-other@convera.test"


def _get_or_create_user(db, email: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        return user
    user = User(email=email, full_name="Email Verify", hashed_password="not-a-real-hash", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_meeting_and_upload(db, user: User):
    meeting = create_meeting(
        db, user_id=user.id,
        meeting_in=MeetingCreate(title="meeting-notes-email-verify", source_type="upload-recording"),
    )
    upload = create_upload(
        db, user_id=user.id, meeting_id=meeting.id,
        original_filename="meeting-notes-email-verify.wav",
        stored_filename=f"{uuid.uuid4()}.wav",
        storage_path=f"verify/{uuid.uuid4()}.wav",
        bucket="test-bucket", mime_type="audio/wav", size_bytes=1234,
    )
    return meeting, upload


class _FakeSummaryProvider:
    def generate_structured_summary(self, text: str, *, language=None) -> StructuredSummaryResult:
        return StructuredSummaryResult(
            executive_summary="AI executive summary for email verify.",
            decisions=[SummaryTextItem(text="AI decision")],
            action_items=[ActionItem(text="AI action item")],
        )


def _patch_ai(monkeypatch_registry: list) -> None:
    import app.services.normalization_service as normalization_service
    import app.services.summary_service as summary_service

    def _raise_unavailable():
        raise RuntimeError("normalization provider unavailable in verification run")

    original_norm = normalization_service.get_normalization_ai_provider
    normalization_service.get_normalization_ai_provider = _raise_unavailable
    monkeypatch_registry.append((normalization_service, "get_normalization_ai_provider", original_norm))

    original_summary = summary_service.get_summary_ai_provider
    summary_service.get_summary_ai_provider = lambda: _FakeSummaryProvider()
    monkeypatch_registry.append((summary_service, "get_summary_ai_provider", original_summary))


def _unpatch(monkeypatch_registry: list) -> None:
    for module, attr, original in monkeypatch_registry:
        setattr(module, attr, original)
    monkeypatch_registry.clear()


def _fingerprint(db, meeting_id):
    return (
        db.query(Transcript).filter(Transcript.meeting_id == meeting_id).first().transcript,
        db.query(Summary).filter(Summary.meeting_id == meeting_id).first().executive_summary,
        db.query(MeetingNotes).filter(MeetingNotes.meeting_id == meeting_id).first().executive_summary,
        db.query(MeetingNotes).filter(MeetingNotes.meeting_id == meeting_id).count(),
    )


def check_a_unconfigured_provider(db, meeting_id, user) -> None:
    settings = get_settings()
    settings.resend_api_key = ""
    settings.resend_from_email = ""
    before = _fingerprint(db, meeting_id)
    try:
        send_meeting_notes_email(db, meeting_id, user, "pdf")
        raise AssertionError("expected AppError for unconfigured provider")
    except AppError as exc:
        assert exc.status_code == 502, f"expected 502, got {exc.status_code}"
    after = _fingerprint(db, meeting_id)
    assert before == after, "unconfigured-provider failure must not touch Transcript/Summary/MeetingNotes"
    print("OK A: unconfigured provider raises 502 AppError, data untouched")


def check_b_successful_send(db, meeting_id, user, monkeypatch_registry: list) -> None:
    settings = get_settings()
    settings.resend_api_key = "test-key"
    settings.resend_from_email = "Converra <notifications@convera.test>"

    captured = {}

    class _FakeResponse:
        status_code = 200

    def _fake_post(url, json, headers, timeout):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        return _FakeResponse()

    original_post = httpx.post
    httpx.post = _fake_post
    monkeypatch_registry.append((httpx, "post", original_post))

    before = _fingerprint(db, meeting_id)
    notes = get_meeting_notes(db, meeting_id, user.id)
    recipient = send_meeting_notes_email(db, meeting_id, user, "docx")
    after = _fingerprint(db, meeting_id)

    assert recipient == user.email, "recipient must be the authenticated user's own email"
    assert captured["json"]["to"] == [user.email]
    assert notes.title in captured["json"]["subject"], "subject must reference the meeting title"
    assert len(captured["json"]["attachments"]) == 1
    assert captured["json"]["attachments"][0]["filename"].endswith(".docx")
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert before == after, "a successful send must not touch Transcript/Summary/MeetingNotes"
    print(f"OK B: successful send -> {recipient}, subject={captured['json']['subject']!r}, "
          f"attachment={captured['json']['attachments'][0]['filename']}")


def check_c_provider_failure(db, meeting_id, user, monkeypatch_registry: list) -> None:
    class _FakeErrorResponse:
        status_code = 422

    def _fake_post(url, json, headers, timeout):
        return _FakeErrorResponse()

    original_post = httpx.post
    httpx.post = _fake_post
    monkeypatch_registry.append((httpx, "post", original_post))

    before = _fingerprint(db, meeting_id)
    try:
        send_meeting_notes_email(db, meeting_id, user, "pptx")
        raise AssertionError("expected AppError for provider failure")
    except AppError as exc:
        assert exc.status_code == 502, f"expected 502, got {exc.status_code}"
    after = _fingerprint(db, meeting_id)
    assert before == after, "provider failure must not touch Transcript/Summary/MeetingNotes"
    print("OK C: provider failure raises 502 AppError, data untouched")


def check_d_unauthorized_rejected(db, meeting_id, other_user) -> None:
    try:
        send_meeting_notes_email(db, meeting_id, other_user, "pdf")
        raise AssertionError("unauthorized email send must be rejected")
    except AppError as exc:
        assert exc.status_code == 404, f"expected 404, got {exc.status_code}"
    print("OK D: unauthorized meeting/email request rejected (404)")


def cleanup(meeting_ids: list, upload_ids: list) -> None:
    db = SessionLocal()
    try:
        db.query(MeetingNotes).filter(MeetingNotes.meeting_id.in_(meeting_ids)).delete(synchronize_session=False)
        db.query(Summary).filter(Summary.meeting_id.in_(meeting_ids)).delete(synchronize_session=False)
        db.query(Transcript).filter(Transcript.meeting_id.in_(meeting_ids)).delete(synchronize_session=False)
        db.query(Upload).filter(Upload.id.in_(upload_ids)).delete(synchronize_session=False)
        db.query(Meeting).filter(Meeting.id.in_(meeting_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def main() -> int:
    ai_patches: list = []
    http_patches: list = []
    settings = get_settings()
    original_api_key = settings.resend_api_key
    original_from_email = settings.resend_from_email

    db = SessionLocal()
    try:
        user = _get_or_create_user(db, PRIMARY_EMAIL)
        other_user = _get_or_create_user(db, OTHER_EMAIL)
        meeting, upload = _make_meeting_and_upload(db, user)
        meeting_id, upload_id = meeting.id, upload.id
        user_id, other_user_id = user.id, other_user.id
    finally:
        db.close()

    try:
        db = SessionLocal()
        try:
            _patch_ai(ai_patches)
            upsert_transcript(
                db, meeting_id=meeting_id, upload_id=upload_id, language="en",
                transcript="Alice: Let's discuss email delivery.",
                segments=[{"start": 0.0, "end": 2.0, "text": "Alice: Let's discuss email delivery."}],
                duration=2.0, word_count=5,
            )
            run_post_transcription_pipeline(db, meeting_id)
            user = db.query(User).filter(User.id == user_id).first()
            other_user = db.query(User).filter(User.id == other_user_id).first()

            check_a_unconfigured_provider(db, meeting_id, user)
            check_b_successful_send(db, meeting_id, user, http_patches)
            _unpatch(http_patches)
            check_c_provider_failure(db, meeting_id, user, http_patches)
            _unpatch(http_patches)
            check_d_unauthorized_rejected(db, meeting_id, other_user)
        finally:
            db.close()
    except AssertionError as exc:
        print(f"FAILED: {exc}")
        _unpatch(ai_patches)
        _unpatch(http_patches)
        settings.resend_api_key = original_api_key
        settings.resend_from_email = original_from_email
        cleanup([meeting_id], [upload_id])
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED: unexpected error: {exc}")
        _unpatch(ai_patches)
        _unpatch(http_patches)
        settings.resend_api_key = original_api_key
        settings.resend_from_email = original_from_email
        cleanup([meeting_id], [upload_id])
        return 1

    _unpatch(ai_patches)
    _unpatch(http_patches)
    settings.resend_api_key = original_api_key
    settings.resend_from_email = original_from_email
    cleanup([meeting_id], [upload_id])
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
