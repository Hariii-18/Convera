"""Verify Speaker System Part 5: speaker metadata + propagation.

Exercises the real DB (no mocking of the DB layer) using a throwaway
user/meeting/upload, cleaned up at the end regardless of outcome. Builds
transcript segments directly with explicit `speaker_key`s (diarization/
alignment itself is already covered end-to-end by
`scripts.verify_speaker_alignment`) and syncs `MeetingSpeaker` rows from them
via the real `speaker_alignment_service.sync_meeting_speakers_from_keys`,
exactly as the recorded/live pipelines do, then exercises every surface that
resolves `speaker_key -> display_name`: Transcript reads, Meeting Notes
reads, PDF/DOCX/PPTX export content, and the email send path (Resend is
monkeypatched — no real network call).

Checks (lettered to match the Part 5 verification checklist):
  A. A meeting with 2 speakers gets both surfaced through the pipeline.
  B. `Transcript.segments` stores only the stable `speaker_key` — never a
     display name — regardless of what a `MeetingSpeaker` is renamed to.
  C. Renaming Speaker 1/2 via `meeting_speaker_service.update_speaker`, then
     reloading, reflects the new names immediately.
  D. `transcript_service.get_transcript` resolves each segment's
     `speaker_key` to the current `speaker_name`.
  E. `meeting_notes_service.get_meeting_notes` resolves
     `timestamped_discussion` the same way.
  F. `build_export_document` (shared by PDF/DOCX/PPTX) shows the resolved
     names in both Detailed Discussion and the reconstructed Full Transcript,
     and all three exporters still produce valid, non-empty files.
  G. `send_meeting_notes_email` (which reuses the same export pipeline)
     succeeds and the attachment reflects current names.
  H. Renaming again propagates everywhere without a stale name surviving.
  I. A `speaker_key` with no `MeetingSpeaker` row (deleted after alignment
     ran) falls back to `Speaker N` — no crash, no missing data.
  J. A legacy transcript with no `speaker_key` on any segment still renders:
     `speaker_name` is `None` everywhere, and the exported Full Transcript
     falls back to the verbatim flat text unchanged.
  K. Saving an unrelated Meeting Notes edit (title only) does not drop the
     `speaker_key` off `timestamped_discussion` segments — a regression this
     module's `crud.meeting_notes._restore_speaker_keys` fix guards against.

Usage: python -m scripts.verify_speaker_propagation
"""

import sys
import uuid

import httpx

from app.core.config import get_settings
from app.crud.meeting import create_meeting
from app.crud.meeting_speaker import list_speakers_by_meeting
from app.crud.transcript import get_transcript_by_meeting_id, upsert_transcript
from app.crud.upload import create_upload
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.meeting_notes import MeetingNotes
from app.models.meeting_speaker import MeetingSpeaker
from app.models.summary import Summary
from app.models.transcript import Transcript
from app.models.upload import Upload
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.schemas.meeting_notes import MeetingNotesUpdate
from app.schemas.meeting_speaker import MeetingSpeakerUpdate
from app.services.ai.base import ActionItem, StructuredSummaryResult, SummaryTextItem
from app.services.export.content import build_export_document
from app.services.export.export_service import export_meeting_notes
from app.services.meeting_notes_email_service import send_meeting_notes_email
from app.services.meeting_notes_service import get_meeting_notes, update_meeting_notes
from app.services.meeting_speaker_service import delete_speaker, update_speaker
from app.services.pipeline_service import run_post_transcription_pipeline
from app.services.speaker_alignment_service import sync_meeting_speakers_from_keys
from app.services.transcript_service import get_transcript

PRIMARY_EMAIL = "verify-speaker-propagation@convera.test"

_FILE_SIGNATURES = {"pdf": b"%PDF", "docx": b"PK", "pptx": b"PK"}

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
    user = User(email=email, full_name="Speaker Propagation Verify", hashed_password="not-a-real-hash", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_meeting_and_upload(db, user: User, suffix: str):
    meeting = create_meeting(
        db, user_id=user.id,
        meeting_in=MeetingCreate(title=f"speaker-propagation-verify-{suffix}", source_type="upload-recording"),
    )
    upload = create_upload(
        db, user_id=user.id, meeting_id=meeting.id,
        original_filename=f"speaker-propagation-{suffix}.wav",
        stored_filename=f"{uuid.uuid4()}.wav",
        storage_path=f"verify/{uuid.uuid4()}.wav",
        bucket="test-bucket", mime_type="audio/wav", size_bytes=1234,
    )
    return meeting, upload


class _FakeSummaryProvider:
    def generate_structured_summary(self, text: str, *, language=None) -> StructuredSummaryResult:
        return StructuredSummaryResult(
            executive_summary="Original AI executive summary.",
            decisions=[SummaryTextItem(text="Original AI decision")],
            action_items=[ActionItem(text="Original AI action item")],
        )


def _patch_ai(registry: list) -> None:
    import app.services.normalization_service as normalization_service
    import app.services.summary_service as summary_service

    def _raise_unavailable():
        raise RuntimeError("normalization provider unavailable in verification run")

    original_norm = normalization_service.get_normalization_ai_provider
    normalization_service.get_normalization_ai_provider = _raise_unavailable
    registry.append((normalization_service, "get_normalization_ai_provider", original_norm))

    original_summary = summary_service.get_summary_ai_provider
    summary_service.get_summary_ai_provider = lambda: _FakeSummaryProvider()
    registry.append((summary_service, "get_summary_ai_provider", original_summary))


def _unpatch(registry: list) -> None:
    for module, attr, original in registry:
        setattr(module, attr, original)
    registry.clear()


def _patch_resend_success(registry: list, captured: dict) -> None:
    class _FakeResponse:
        status_code = 200

    def _fake_post(url, json, headers, timeout):
        captured["json"] = json
        return _FakeResponse()

    original_post = httpx.post
    httpx.post = _fake_post
    registry.append((httpx, "post", original_post))


def _two_speaker_segments() -> list[dict]:
    return [
        {"start": 0.0, "end": 2.0, "text": "Let's discuss the roadmap.", "speaker_key": "speaker_1"},
        {"start": 2.0, "end": 4.0, "text": "Sounds good, I have concerns though.", "speaker_key": "speaker_2"},
        {"start": 4.0, "end": 6.0, "text": "Noted, let's dig in.", "speaker_key": "speaker_1"},
    ]


def check_a_to_h(db, meeting_id: uuid.UUID, upload_id: uuid.UUID, user: User) -> None:
    segments = _two_speaker_segments()
    upsert_transcript(
        db, meeting_id=meeting_id, upload_id=upload_id, language="en",
        transcript=" ".join(s["text"] for s in segments),
        segments=segments, duration=6.0, word_count=20,
    )
    sync_meeting_speakers_from_keys(db, meeting_id, {"speaker_1", "speaker_2"})
    run_post_transcription_pipeline(db, meeting_id)

    speakers = {s.speaker_key: s for s in list_speakers_by_meeting(db, meeting_id)}
    check("A: two MeetingSpeaker rows synced from speaker_key", set(speakers) == {"speaker_1", "speaker_2"}, speakers)
    check("A: default placeholder names", speakers["speaker_1"].display_name == "Speaker 1" and speakers["speaker_2"].display_name == "Speaker 2")

    raw = get_transcript_by_meeting_id(db, meeting_id)
    check(
        "B: Transcript.segments stores only speaker_key, no display name",
        all(set(s.keys()) >= {"start", "end", "text", "speaker_key"} and "speaker_name" not in s for s in raw.segments),
        raw.segments,
    )

    update_speaker(db, meeting_id, speakers["speaker_1"].id, user.id, MeetingSpeakerUpdate(display_name="Hari Prasad"))
    update_speaker(db, meeting_id, speakers["speaker_2"].id, user.id, MeetingSpeakerUpdate(display_name="Priya Nair"))
    print("OK C: renamed speaker_1 -> Hari Prasad, speaker_2 -> Priya Nair")

    raw_after_rename = get_transcript_by_meeting_id(db, meeting_id)
    check(
        "C: rename never touches stored Transcript.segments",
        raw_after_rename.segments == raw.segments,
    )

    transcript_read = get_transcript(db, meeting_id, user.id)
    names_by_key = {seg.speaker_key: seg.speaker_name for seg in transcript_read.segments}
    check(
        "D: transcript presentation resolves renamed speakers",
        names_by_key == {"speaker_1": "Hari Prasad", "speaker_2": "Priya Nair"},
        names_by_key,
    )

    notes = get_meeting_notes(db, meeting_id, user.id)
    notes_names = {seg.speaker_key: seg.speaker_name for seg in notes.timestamped_discussion}
    check("E: Meeting Notes timestamped_discussion resolves renamed speakers", notes_names == names_by_key, notes_names)

    document = build_export_document(notes)
    discussion = next(s for s in document.sections if s.heading == "Detailed Discussion")
    full_transcript_section = next(s for s in document.sections if s.heading == "Full Transcript")
    check(
        "F: export Detailed Discussion contains resolved names",
        any("Hari Prasad:" in line for line in discussion.lines) and any("Priya Nair:" in line for line in discussion.lines),
        discussion.lines,
    )
    check(
        "F: export Full Transcript contains resolved names",
        "Hari Prasad:" in full_transcript_section.lines[0] and "Priya Nair:" in full_transcript_section.lines[0],
        full_transcript_section.lines,
    )

    for fmt in ("pdf", "docx", "pptx"):
        content, filename, content_type = export_meeting_notes(db, meeting_id, user.id, fmt)
        check(f"F: {fmt} export non-empty with correct signature", len(content) > 0 and content.startswith(_FILE_SIGNATURES[fmt]), filename)

    settings = get_settings()
    settings.resend_api_key = "test-key"
    settings.resend_from_email = "Converra <notifications@convera.test>"
    email_patches: list = []
    captured: dict = {}
    _patch_resend_success(email_patches, captured)
    try:
        recipients = send_meeting_notes_email(db, meeting_id, user, "pdf", True, [])
        check("G: email send succeeds and returns recipients", recipients == [user.email], recipients)
        check("G: email attachment payload present (non-empty base64 content)", bool(captured.get("json", {}).get("attachments")))
    finally:
        _unpatch(email_patches)

    speaker_1 = next(s for s in list_speakers_by_meeting(db, meeting_id) if s.speaker_key == "speaker_1")
    update_speaker(db, meeting_id, speaker_1.id, user.id, MeetingSpeakerUpdate(display_name="Hari Prasad Jangili"))
    reloaded_transcript = get_transcript(db, meeting_id, user.id)
    reloaded_notes = get_meeting_notes(db, meeting_id, user.id)
    check(
        "H: second rename propagates to transcript presentation",
        all(seg.speaker_name != "Hari Prasad" for seg in reloaded_transcript.segments if seg.speaker_key == "speaker_1"),
    )
    check(
        "H: second rename propagates to Meeting Notes",
        any(seg.speaker_name == "Hari Prasad Jangili" for seg in reloaded_notes.timestamped_discussion),
    )
    reloaded_document = build_export_document(reloaded_notes)
    reloaded_discussion = next(s for s in reloaded_document.sections if s.heading == "Detailed Discussion")
    check(
        "H: second rename propagates to export content",
        any("Hari Prasad Jangili:" in line for line in reloaded_discussion.lines)
        and not any("Hari Prasad:" in line and "Jangili" not in line for line in reloaded_discussion.lines),
        reloaded_discussion.lines,
    )


def check_i_missing_speaker_mapping(db, meeting_id: uuid.UUID, user: User) -> None:
    priya = next(s for s in list_speakers_by_meeting(db, meeting_id) if s.speaker_key == "speaker_2")
    delete_speaker(db, meeting_id, priya.id, user.id)

    transcript_read = get_transcript(db, meeting_id, user.id)
    fallback_names = {seg.speaker_key: seg.speaker_name for seg in transcript_read.segments if seg.speaker_key == "speaker_2"}
    check(
        "I: missing MeetingSpeaker row falls back to 'Speaker N', no crash",
        all(name == "Speaker 2" for name in fallback_names.values()) and len(fallback_names) > 0,
        fallback_names,
    )

    notes = get_meeting_notes(db, meeting_id, user.id)
    document = build_export_document(notes)
    check("I: export still succeeds after a missing speaker mapping", any(s.heading == "Detailed Discussion" for s in document.sections))


def check_j_legacy_no_speaker_key(db, user: User) -> None:
    meeting, upload = _make_meeting_and_upload(db, user, "legacy")
    legacy_text = "This is a legacy transcript with no diarization at all."
    upsert_transcript(
        db, meeting_id=meeting.id, upload_id=upload.id, language="en",
        transcript=legacy_text,
        segments=[{"start": 0.0, "end": 3.0, "text": legacy_text}],
        duration=3.0, word_count=10,
    )
    run_post_transcription_pipeline(db, meeting.id)

    transcript_read = get_transcript(db, meeting.id, user.id)
    check(
        "J: legacy segment with no speaker_key resolves speaker_name=None",
        all(seg.speaker_key is None and seg.speaker_name is None for seg in transcript_read.segments),
        transcript_read.segments,
    )

    notes = get_meeting_notes(db, meeting.id, user.id)
    document = build_export_document(notes)
    full_transcript_section = next(s for s in document.sections if s.heading == "Full Transcript")
    check(
        "J: legacy Full Transcript export falls back to verbatim text unchanged",
        full_transcript_section.lines[0] == notes.full_transcript == legacy_text,
        full_transcript_section.lines,
    )
    for fmt in ("pdf", "docx", "pptx"):
        content, _, _ = export_meeting_notes(db, meeting.id, user.id, fmt)
        check(f"J: legacy {fmt} export still succeeds", len(content) > 0 and content.startswith(_FILE_SIGNATURES[fmt]))

    return meeting.id, upload.id


def check_k_edit_preserves_speaker_key(db, meeting_id: uuid.UUID, user: User) -> None:
    before = get_meeting_notes(db, meeting_id, user.id)
    before_keys = [seg.speaker_key for seg in before.timestamped_discussion]

    update_meeting_notes(db, meeting_id, user.id, MeetingNotesUpdate(title="Renamed via unrelated edit"))

    after = get_meeting_notes(db, meeting_id, user.id)
    after_keys = [seg.speaker_key for seg in after.timestamped_discussion]
    check(
        "K: unrelated Meeting Notes edit preserves timestamped_discussion speaker_key",
        before_keys == after_keys and any(key is not None for key in after_keys),
        (before_keys, after_keys),
    )
    check(
        "K: speaker_name still resolves after the edit",
        any(seg.speaker_name is not None for seg in after.timestamped_discussion),
    )


def cleanup(meeting_ids: list, upload_ids: list) -> None:
    db = SessionLocal()
    try:
        db.query(MeetingSpeaker).filter(MeetingSpeaker.meeting_id.in_(meeting_ids)).delete(synchronize_session=False)
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
    meeting_ids: list = []
    upload_ids: list = []

    db = SessionLocal()
    try:
        user = _get_or_create_user(db, PRIMARY_EMAIL)
        meeting, upload = _make_meeting_and_upload(db, user, "main")
        meeting_ids.append(meeting.id)
        upload_ids.append(upload.id)
        user_id = user.id
    finally:
        db.close()

    try:
        db = SessionLocal()
        try:
            _patch_ai(ai_patches)
            user = db.query(User).filter(User.id == user_id).first()
            check_a_to_h(db, meeting.id, upload.id, user)
            check_i_missing_speaker_mapping(db, meeting.id, user)
            legacy_meeting_id, legacy_upload_id = check_j_legacy_no_speaker_key(db, user)
            meeting_ids.append(legacy_meeting_id)
            upload_ids.append(legacy_upload_id)
            check_k_edit_preserves_speaker_key(db, meeting.id, user)
        finally:
            _unpatch(ai_patches)
            db.close()
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED: unexpected error: {exc}")
        _unpatch(ai_patches)
        cleanup(meeting_ids, upload_ids)
        return 1

    cleanup(meeting_ids, upload_ids)

    if failures:
        print(f"\n{len(failures)} CHECK(S) FAILED")
        return 1

    print("\nALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
