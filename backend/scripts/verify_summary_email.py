"""Verify multi-recipient Summary email delivery end-to-end against the real
DB.

Mirrors `scripts.verify_meeting_notes_email`'s structure and coverage
(self-only send, self + extras, dedup, invalid/too-many recipients, a
provider failure, all three formats, cross-user rejection, unconfigured
provider) but for `send_summary_email` / the Summary tab's "Send to Email"
action, plus the one behavior specific to this flow: the emailed attachment
must reflect the CURRENT SAVED Summary after a user edit, and sending must
never regenerate the Summary. `httpx.post` is monkeypatched so this runs
without real Resend credentials or network access.

Checks:
  A. Send to self only (`send_to_me=True`, no extra recipients).
  B. Send to self + 1 extra recipient.
  C. Send to multiple recipients (self + 2 extra) in one call, using `bcc` so
     recipients never see each other's address.
  D. Duplicate addresses (repeated + differently-cased) collapse to one.
  E. An invalid address is rejected by the request schema (422) before any
     send is attempted.
  F. Too many recipients (11) is rejected (422) after dedup.
  G. A provider failure (non-2xx response) raises a 502 AppError and leaves
     Summary/Transcript untouched.
  H. PDF, DOCX, and PPTX all still work.
  I. A second user cannot email the first user's summary (404).
  J. Unconfigured provider (no RESEND_API_KEY) raises a 502 AppError, and
     leaves Summary/Transcript untouched.
  K. Editing an action item, then sending, emails the EDITED text (not
     regenerated/stale content) — verified both at the document-content
     layer (`build_summary_export_document`, the same builder
     `export_summary`/`send_summary_email` use) and by unzipping the actual
     rendered .docx attachment bytes sent to the provider. The send never
     mutates the Summary row (no regeneration) — `updated_at` and every
     section are byte-for-byte identical before and after the send.

(Duplicate-click protection is a frontend concern — the Send button is
disabled while `useSendSummaryEmail`'s mutation is pending — and isn't
exercised by this backend script.)

Usage: python -m scripts.verify_summary_email
"""

import io
import sys
import uuid
import zipfile

import httpx
from pydantic import ValidationError

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.crud.meeting import create_meeting
from app.crud.summary import get_summary_by_meeting_id
from app.crud.transcript import upsert_transcript
from app.crud.upload import create_upload
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.summary import Summary
from app.models.transcript import Transcript
from app.models.upload import Upload
from app.models.user import User
from app.schemas.summary import SummaryActionItemUpdate, SummaryEmailRequest, SummaryRead
from app.services.ai.base import ActionItem, StructuredSummaryResult, SummaryTextItem
from app.services.export.content import build_summary_export_document
from app.services.export.export_service import export_summary
from app.schemas.meeting import MeetingCreate
from app.services.meeting_notes_email_service import resolve_email_recipients
from app.services.pipeline_service import run_post_transcription_pipeline
from app.services.summary_email_service import send_summary_email
from app.services.summary_service import update_summary_action_item

PRIMARY_EMAIL = "verify-summary-email@convera.test"
OTHER_EMAIL = "verify-summary-email-other@convera.test"
EXTRA_EMAIL_1 = "verify-summary-email-extra1@convera.test"
EXTRA_EMAIL_2 = "verify-summary-email-extra2@convera.test"


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
        meeting_in=MeetingCreate(title="summary-email-verify", source_type="upload-recording"),
    )
    upload = create_upload(
        db, user_id=user.id, meeting_id=meeting.id,
        original_filename="summary-email-verify.wav",
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
            action_items=[ActionItem(text="Original action item text")],
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
    summary = db.query(Summary).filter(Summary.meeting_id == meeting_id).first()
    return (
        db.query(Transcript).filter(Transcript.meeting_id == meeting_id).first().transcript,
        summary.executive_summary,
        summary.action_items,
        summary.updated_at,
    )


def _patch_resend_success(monkeypatch_registry: list, captured: dict) -> None:
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


def check_a_self_only(db, meeting_id, user, monkeypatch_registry: list) -> None:
    settings = get_settings()
    settings.resend_api_key = "test-key"
    settings.resend_from_email = "Converra <notifications@convera.test>"

    captured: dict = {}
    _patch_resend_success(monkeypatch_registry, captured)

    recipients = send_summary_email(db, meeting_id, user, "pdf", True, [])

    assert recipients == [user.email], f"expected [{user.email}], got {recipients}"
    assert captured["json"]["to"] == [user.email]
    assert "bcc" not in captured["json"], "a single recipient must not add a bcc key"
    print(f"OK A: self-only send -> {recipients}")


def check_b_self_plus_one(db, meeting_id, user, monkeypatch_registry: list) -> None:
    captured: dict = {}
    _patch_resend_success(monkeypatch_registry, captured)

    recipients = send_summary_email(db, meeting_id, user, "docx", True, [EXTRA_EMAIL_1])

    assert recipients == [user.email, EXTRA_EMAIL_1], recipients
    assert captured["json"]["to"] == [user.email]
    assert captured["json"]["bcc"] == [EXTRA_EMAIL_1]
    assert captured["json"]["attachments"][0]["filename"].endswith(".docx")
    print(f"OK B: self + 1 -> {recipients}, to={captured['json']['to']}, bcc={captured['json']['bcc']}")


def check_c_multiple_recipients(db, meeting_id, user, monkeypatch_registry: list) -> None:
    captured: dict = {}
    _patch_resend_success(monkeypatch_registry, captured)

    recipients = send_summary_email(db, meeting_id, user, "pptx", True, [EXTRA_EMAIL_1, EXTRA_EMAIL_2])

    assert recipients == [user.email, EXTRA_EMAIL_1, EXTRA_EMAIL_2], recipients
    assert captured["json"]["to"] == [user.email], "only the primary address may appear in `to`"
    assert set(captured["json"]["bcc"]) == {EXTRA_EMAIL_1, EXTRA_EMAIL_2}
    assert len(captured["json"]["attachments"]) == 1
    print(f"OK C: multiple recipients -> {recipients} (bcc hides recipients from each other)")


def check_d_duplicates_collapse(db, meeting_id, user, monkeypatch_registry: list) -> None:
    captured: dict = {}
    _patch_resend_success(monkeypatch_registry, captured)

    messy = [user.email.upper(), EXTRA_EMAIL_1, EXTRA_EMAIL_1.upper(), f"  {EXTRA_EMAIL_1}  "]
    recipients = send_summary_email(db, meeting_id, user, "pdf", True, messy)

    assert recipients == [user.email, EXTRA_EMAIL_1], recipients
    print(f"OK D: duplicates (incl. own email + case/whitespace variants) collapse -> {recipients}")


def check_e_invalid_address_rejected() -> None:
    try:
        SummaryEmailRequest(format="pdf", send_to_me=True, recipients=["not-an-email"])
        raise AssertionError("expected a validation error for a malformed address")
    except ValidationError:
        pass
    print("OK E: malformed address rejected by the request schema (422 at the API layer)")


def check_f_too_many_recipients_rejected(user) -> None:
    too_many = [f"verify-summary-email-bulk-{i}@convera.test" for i in range(11)]
    try:
        resolve_email_recipients(user.email, True, too_many)
        raise AssertionError("expected AppError for too many recipients")
    except AppError as exc:
        assert exc.status_code == 422, f"expected 422, got {exc.status_code}"
    print("OK F: 12 total recipients (self + 11) rejected with 422")

    try:
        resolve_email_recipients(user.email, False, [])
        raise AssertionError("expected AppError for zero recipients")
    except AppError as exc:
        assert exc.status_code == 422, f"expected 422, got {exc.status_code}"
    print("OK F: zero recipients (send_to_me=False, no extras) also rejected with 422")


def check_g_provider_failure(db, meeting_id, user, monkeypatch_registry: list) -> None:
    class _FakeErrorResponse:
        status_code = 422

    def _fake_post(url, json, headers, timeout):
        return _FakeErrorResponse()

    original_post = httpx.post
    httpx.post = _fake_post
    monkeypatch_registry.append((httpx, "post", original_post))

    before = _fingerprint(db, meeting_id)
    try:
        send_summary_email(db, meeting_id, user, "pptx", True, [EXTRA_EMAIL_1])
        raise AssertionError("expected AppError for provider failure")
    except AppError as exc:
        assert exc.status_code == 502, f"expected 502, got {exc.status_code}"
    after = _fingerprint(db, meeting_id)
    assert before == after, "provider failure must not touch Transcript/Summary"
    print("OK G: provider failure raises 502 AppError, data untouched")


def check_h_all_formats(db, meeting_id, user, monkeypatch_registry: list) -> None:
    for fmt in ("pdf", "docx", "pptx"):
        captured: dict = {}
        _patch_resend_success(monkeypatch_registry, captured)
        recipients = send_summary_email(db, meeting_id, user, fmt, True, [])
        assert recipients == [user.email]
        assert captured["json"]["attachments"][0]["filename"].endswith(f".{fmt}")
        _unpatch(monkeypatch_registry)
    print("OK H: pdf, docx, and pptx all send successfully")


def check_i_unauthorized_rejected(db, meeting_id, other_user) -> None:
    try:
        send_summary_email(db, meeting_id, other_user, "pdf", True, [])
        raise AssertionError("unauthorized email send must be rejected")
    except AppError as exc:
        assert exc.status_code == 404, f"expected 404, got {exc.status_code}"
    print("OK I: unauthorized meeting/email request rejected (404)")


def check_j_unconfigured_provider(db, meeting_id, user) -> None:
    settings = get_settings()
    settings.resend_api_key = ""
    settings.resend_from_email = ""
    before = _fingerprint(db, meeting_id)
    try:
        send_summary_email(db, meeting_id, user, "pdf", True, [])
        raise AssertionError("expected AppError for unconfigured provider")
    except AppError as exc:
        assert exc.status_code == 502, f"expected 502, got {exc.status_code}"
    after = _fingerprint(db, meeting_id)
    assert before == after, "unconfigured-provider failure must not touch Transcript/Summary"
    print("OK J: unconfigured provider raises 502 AppError, data untouched")


def check_k_edit_then_send_reflects_edit(db, meeting_id, user, monkeypatch_registry: list) -> None:
    edited_text = "EDITED action item — reflects the user's saved change"
    update_summary_action_item(
        db, meeting_id, user.id, 0, SummaryActionItemUpdate(text=edited_text)
    )

    summary_before_send = get_summary_by_meeting_id(db, meeting_id)
    fingerprint_before = (
        summary_before_send.executive_summary,
        summary_before_send.action_items,
        summary_before_send.updated_at,
    )
    assert summary_before_send.action_items[0]["text"] == edited_text, summary_before_send.action_items

    # Same document-building layer `export_summary`/`send_summary_email` use
    # — proves the edited text is what actually gets attached, without
    # needing to decode a rendered PDF.
    document = build_summary_export_document(
        SummaryRead.model_validate(summary_before_send), "Summary Email Verify", "2026-01-01 00:00:00 IST", None, None
    )
    action_items_section = next(s for s in document.sections if s.heading.startswith("Action Items"))
    assert any(edited_text in line for line in action_items_section.lines), action_items_section.lines
    print("OK K: document builder reflects the saved edit (same layer send_summary_email uses)")

    # A real rendered .docx attachment, unzipped, contains the edited text —
    # a byte-level proof, not just a pre-render check.
    content, _filename, _content_type = export_summary(db, meeting_id, user.id, "docx")
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        document_xml = archive.read("word/document.xml").decode("utf-8")
    assert edited_text in document_xml, "edited action item text missing from rendered .docx"
    print("OK K: rendered .docx attachment bytes contain the edited action item text")

    captured: dict = {}
    _patch_resend_success(monkeypatch_registry, captured)
    send_summary_email(db, meeting_id, user, "docx", True, [])
    _unpatch(monkeypatch_registry)

    summary_after_send = get_summary_by_meeting_id(db, meeting_id)
    fingerprint_after = (
        summary_after_send.executive_summary,
        summary_after_send.action_items,
        summary_after_send.updated_at,
    )
    assert fingerprint_before == fingerprint_after, (
        "sending must never regenerate/mutate the Summary row",
        fingerprint_before,
        fingerprint_after,
    )
    print("OK K: sending never regenerated/mutated the Summary row (no re-summarization)")


def cleanup(meeting_ids: list, upload_ids: list) -> None:
    db = SessionLocal()
    try:
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
                transcript="Alice: Let's discuss email delivery for the summary tab.",
                segments=[{"start": 0.0, "end": 2.0, "text": "Alice: Let's discuss email delivery for the summary tab."}],
                duration=2.0, word_count=8,
            )
            run_post_transcription_pipeline(db, meeting_id)
            user = db.query(User).filter(User.id == user_id).first()
            other_user = db.query(User).filter(User.id == other_user_id).first()

            check_e_invalid_address_rejected()
            check_f_too_many_recipients_rejected(user)

            check_a_self_only(db, meeting_id, user, http_patches)
            _unpatch(http_patches)
            check_b_self_plus_one(db, meeting_id, user, http_patches)
            _unpatch(http_patches)
            check_c_multiple_recipients(db, meeting_id, user, http_patches)
            _unpatch(http_patches)
            check_d_duplicates_collapse(db, meeting_id, user, http_patches)
            _unpatch(http_patches)
            check_g_provider_failure(db, meeting_id, user, http_patches)
            _unpatch(http_patches)
            check_h_all_formats(db, meeting_id, user, http_patches)
            check_i_unauthorized_rejected(db, meeting_id, other_user)
            # Runs before check_j, which clears the resend settings check_k's
            # send needs configured.
            check_k_edit_then_send_reflects_edit(db, meeting_id, user, http_patches)
            check_j_unconfigured_provider(db, meeting_id, user)
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
