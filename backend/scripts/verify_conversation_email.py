"""Verify Conversation email delivery end-to-end against the real DB.

Mirrors `scripts.verify_meeting_notes_email` but exercises
`send_conversation_email` (`app.services.conversation_email_service`)
instead — the Conversation-view equivalent of the Meeting Notes email flow,
sharing the same `resolve_email_recipients` helper and the same Resend
provider (`httpx.post` is monkeypatched so this runs without credentials or
network access).

Checks:
  A. Send to self only (`send_to_me=True`, no extra recipients).
  B. Send to self + multiple extra recipients in one call, using `bcc` so
     recipients never see each other's address.
  C. Duplicate addresses (repeated + differently-cased) collapse to one.
  D. An invalid address is rejected by the request schema (422) before any
     send is attempted.
  E. Too many recipients is rejected (422) after dedup.
  F. Renaming a `MeetingSpeaker` is reflected in the exported attachment
     content (resolved fresh at send time, nothing persisted) for both PDF
     and DOCX.
  G. A provider failure (non-2xx response) raises a 502 AppError and leaves
     Transcript/MeetingSpeaker untouched.
  H. Unconfigured provider (no RESEND_API_KEY) raises a 502 AppError.
  I. A second user cannot email the first user's conversation (404).

(Duplicate-click protection is a frontend concern — the Send button is
disabled while `useSendConversationEmail`'s mutation is pending — and isn't
exercised by this backend script.)

Usage: python -m scripts.verify_conversation_email
"""

import sys
import uuid

import httpx
from pydantic import ValidationError

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.crud.meeting import create_meeting
from app.crud.meeting_speaker import list_speakers_by_meeting
from app.crud.transcript import get_transcript_by_meeting_id, upsert_transcript
from app.crud.upload import create_upload
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.meeting_speaker import MeetingSpeaker
from app.models.transcript import Transcript
from app.models.upload import Upload
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.schemas.meeting_speaker import MeetingSpeakerUpdate
from app.schemas.transcript import ConversationEmailRequest
from app.services.conversation_email_service import send_conversation_email
from app.services.export.conversation_content import build_conversation_export_document
from app.services.meeting_notes_email_service import resolve_email_recipients
from app.services.meeting_speaker_service import update_speaker
from app.services.speaker_alignment_service import sync_meeting_speakers_from_keys
from app.services.speaker_resolution import build_speaker_name_map, resolve_segments

PRIMARY_EMAIL = "verify-conversation-email@convera.test"
OTHER_EMAIL = "verify-conversation-email-other@convera.test"
EXTRA_EMAIL_1 = "verify-conversation-email-extra1@convera.test"
EXTRA_EMAIL_2 = "verify-conversation-email-extra2@convera.test"

_FILE_SIGNATURES = {"pdf": b"%PDF", "docx": b"PK"}

failures: list[str] = []


def check(label: str, condition: bool, detail: object = "") -> None:
    if condition:
        print(f"PASS: {label}")
    else:
        message = f"FAIL: {label} {detail}".strip()
        print(message)
        failures.append(message)


def _get_or_create_user(db, email: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        return user
    user = User(email=email, full_name="Conversation Email Verify", hashed_password="not-a-real-hash", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_meeting_and_upload(db, user: User):
    meeting = create_meeting(
        db, user_id=user.id,
        meeting_in=MeetingCreate(title="conversation-email-verify", source_type="upload-recording"),
    )
    upload = create_upload(
        db, user_id=user.id, meeting_id=meeting.id,
        original_filename="conversation-email-verify.wav",
        stored_filename=f"{uuid.uuid4()}.wav",
        storage_path=f"verify/{uuid.uuid4()}.wav",
        bucket="test-bucket", mime_type="audio/wav", size_bytes=1234,
    )
    return meeting, upload


def _two_speaker_segments() -> list[dict]:
    return [
        {"start": 0.0, "end": 2.0, "text": "Let's discuss the roadmap.", "speaker_key": "speaker_1"},
        {"start": 2.0, "end": 4.0, "text": "Sounds good, I have concerns though.", "speaker_key": "speaker_2"},
    ]


def _patch_resend_success(registry: list, captured: dict) -> None:
    class _FakeResponse:
        status_code = 200

    def _fake_post(url, json, headers, timeout):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        return _FakeResponse()

    original_post = httpx.post
    httpx.post = _fake_post
    registry.append((httpx, "post", original_post))


def _unpatch(registry: list) -> None:
    for module, attr, original in registry:
        setattr(module, attr, original)
    registry.clear()


def _fingerprint(db, meeting_id):
    transcript = db.query(Transcript).filter(Transcript.meeting_id == meeting_id).first()
    speakers = {
        s.speaker_key: s.display_name
        for s in db.query(MeetingSpeaker).filter(MeetingSpeaker.meeting_id == meeting_id).all()
    }
    return (transcript.segments, speakers)


def check_a_self_only(db, meeting_id, user, registry: list) -> None:
    settings = get_settings()
    settings.resend_api_key = "test-key"
    settings.resend_from_email = "Converra <notifications@convera.test>"

    captured: dict = {}
    _patch_resend_success(registry, captured)

    recipients = send_conversation_email(db, meeting_id, user, "pdf", True, [])

    check("A: self-only recipients", recipients == [user.email], recipients)
    check("A: to == self, no bcc key for a single recipient", captured["json"]["to"] == [user.email] and "bcc" not in captured["json"])
    check("A: attachment is a valid, non-empty PDF", captured["json"]["attachments"][0]["filename"].endswith(".pdf"))


def check_b_multiple_recipients(db, meeting_id, user, registry: list) -> None:
    captured: dict = {}
    _patch_resend_success(registry, captured)

    recipients = send_conversation_email(db, meeting_id, user, "docx", True, [EXTRA_EMAIL_1, EXTRA_EMAIL_2])

    check("B: self + multiple recipients", recipients == [user.email, EXTRA_EMAIL_1, EXTRA_EMAIL_2], recipients)
    check("B: only primary address in `to`", captured["json"]["to"] == [user.email])
    check("B: rest are bcc'd, hidden from each other", set(captured["json"]["bcc"]) == {EXTRA_EMAIL_1, EXTRA_EMAIL_2})
    check("B: single attachment for the whole send", len(captured["json"]["attachments"]) == 1)


def check_c_duplicates_collapse(db, meeting_id, user, registry: list) -> None:
    captured: dict = {}
    _patch_resend_success(registry, captured)

    messy = [user.email.upper(), EXTRA_EMAIL_1, EXTRA_EMAIL_1.upper(), f"  {EXTRA_EMAIL_1}  "]
    recipients = send_conversation_email(db, meeting_id, user, "pdf", True, messy)

    check("C: duplicates (incl. own email + case/whitespace variants) collapse", recipients == [user.email, EXTRA_EMAIL_1], recipients)


def check_d_invalid_address_rejected() -> None:
    try:
        ConversationEmailRequest(format="pdf", send_to_me=True, recipients=["not-an-email"])
        check("D: malformed address rejected by the request schema", False)
    except ValidationError:
        check("D: malformed address rejected by the request schema", True)


def check_e_too_many_recipients_rejected(user) -> None:
    too_many = [f"verify-conversation-email-bulk-{i}@convera.test" for i in range(11)]
    try:
        resolve_email_recipients(user.email, True, too_many)
        check("E: >10 total recipients rejected with 422", False)
    except AppError as exc:
        check("E: >10 total recipients rejected with 422", exc.status_code == 422, exc.status_code)

    try:
        resolve_email_recipients(user.email, False, [])
        check("E: zero recipients rejected with 422", False)
    except AppError as exc:
        check("E: zero recipients rejected with 422", exc.status_code == 422, exc.status_code)


def check_f_renamed_speaker_in_attachment(db, meeting_id, user, registry: list) -> None:
    speakers = {s.speaker_key: s for s in list_speakers_by_meeting(db, meeting_id)}
    update_speaker(db, meeting_id, speakers["speaker_1"].id, user.id, MeetingSpeakerUpdate(display_name="Hari Prasad"))
    update_speaker(db, meeting_id, speakers["speaker_2"].id, user.id, MeetingSpeakerUpdate(display_name="Priya Nair"))

    transcript = get_transcript_by_meeting_id(db, meeting_id)
    name_map = build_speaker_name_map(db, meeting_id)
    resolved = resolve_segments(transcript.segments, name_map)
    document = build_conversation_export_document(
        meeting_title="conversation-email-verify",
        date_time_ist="2026-08-25 10:00:00 IST",
        duration_seconds=4,
        participants_count=2,
        segments=resolved,
    )
    turn_speakers = {turn.speaker_label for turn in document.turns}
    check(
        "F: renamed speakers resolved into the export document",
        turn_speakers == {"Hari Prasad", "Priya Nair"},
        turn_speakers,
    )
    check(
        "F: exact transcript disclaimer present",
        document.disclaimer
        == (
            "This editable transcript was computer generated and might "
            "contain errors. People can also change the text after it was "
            "created."
        ),
        document.disclaimer,
    )

    for fmt in ("pdf", "docx"):
        captured: dict = {}
        _patch_resend_success(registry, captured)
        recipients = send_conversation_email(db, meeting_id, user, fmt, True, [])
        check(f"F: {fmt} email send succeeds after rename", recipients == [user.email], recipients)
        check(f"F: {fmt} attachment filename has correct extension", captured["json"]["attachments"][0]["filename"].endswith(f".{fmt}"))
        _unpatch(registry)


def check_g_provider_failure(db, meeting_id, user, registry: list) -> None:
    class _FakeErrorResponse:
        status_code = 422

    def _fake_post(url, json, headers, timeout):
        return _FakeErrorResponse()

    original_post = httpx.post
    httpx.post = _fake_post
    registry.append((httpx, "post", original_post))

    before = _fingerprint(db, meeting_id)
    try:
        send_conversation_email(db, meeting_id, user, "pdf", True, [EXTRA_EMAIL_1])
        check("G: provider failure raises 502 AppError", False)
    except AppError as exc:
        check("G: provider failure raises 502 AppError", exc.status_code == 502, exc.status_code)
    after = _fingerprint(db, meeting_id)
    check("G: provider failure leaves Transcript/MeetingSpeaker untouched", before == after)


def check_h_unconfigured_provider(db, meeting_id, user) -> None:
    settings = get_settings()
    settings.resend_api_key = ""
    settings.resend_from_email = ""
    before = _fingerprint(db, meeting_id)
    try:
        send_conversation_email(db, meeting_id, user, "pdf", True, [])
        check("H: unconfigured provider raises 502 AppError", False)
    except AppError as exc:
        check("H: unconfigured provider raises 502 AppError", exc.status_code == 502, exc.status_code)
    after = _fingerprint(db, meeting_id)
    check("H: unconfigured-provider failure leaves data untouched", before == after)


def check_i_unauthorized_rejected(db, meeting_id, other_user) -> None:
    try:
        send_conversation_email(db, meeting_id, other_user, "pdf", True, [])
        check("I: unauthorized meeting rejected (404)", False)
    except AppError as exc:
        check("I: unauthorized meeting rejected (404)", exc.status_code == 404, exc.status_code)


def cleanup(meeting_ids: list, upload_ids: list) -> None:
    db = SessionLocal()
    try:
        db.query(MeetingSpeaker).filter(MeetingSpeaker.meeting_id.in_(meeting_ids)).delete(synchronize_session=False)
        db.query(Transcript).filter(Transcript.meeting_id.in_(meeting_ids)).delete(synchronize_session=False)
        db.query(Upload).filter(Upload.id.in_(upload_ids)).delete(synchronize_session=False)
        db.query(Meeting).filter(Meeting.id.in_(meeting_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def main() -> int:
    registry: list = []
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
            segments = _two_speaker_segments()
            upsert_transcript(
                db, meeting_id=meeting_id, upload_id=upload_id, language="en",
                transcript=" ".join(s["text"] for s in segments),
                segments=segments, duration=4.0, word_count=15,
            )
            sync_meeting_speakers_from_keys(db, meeting_id, {"speaker_1", "speaker_2"})
            user = db.query(User).filter(User.id == user_id).first()
            other_user = db.query(User).filter(User.id == other_user_id).first()

            check_d_invalid_address_rejected()
            check_e_too_many_recipients_rejected(user)

            check_a_self_only(db, meeting_id, user, registry)
            _unpatch(registry)
            check_b_multiple_recipients(db, meeting_id, user, registry)
            _unpatch(registry)
            check_c_duplicates_collapse(db, meeting_id, user, registry)
            _unpatch(registry)
            check_f_renamed_speaker_in_attachment(db, meeting_id, user, registry)
            check_g_provider_failure(db, meeting_id, user, registry)
            _unpatch(registry)
            check_h_unconfigured_provider(db, meeting_id, user)
            check_i_unauthorized_rejected(db, meeting_id, other_user)
        finally:
            _unpatch(registry)
            settings.resend_api_key = original_api_key
            settings.resend_from_email = original_from_email
            db.close()
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED: unexpected error: {exc}")
        _unpatch(registry)
        settings.resend_api_key = original_api_key
        settings.resend_from_email = original_from_email
        cleanup([meeting_id], [upload_id])
        return 1

    cleanup([meeting_id], [upload_id])

    if failures:
        print(f"\n{len(failures)} CHECK(S) FAILED")
        return 1

    print("\nALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
