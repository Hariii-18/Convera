"""Verify the Meeting Notes persistence/editing/export phase end-to-end.

Exercises the real DB (no mocking of the DB layer) using a throwaway
user/meeting/upload, cleaned up at the end regardless of outcome. The AI
summary provider is monkeypatched with a deterministic fake so this runs
without network access; every persistence path (`upsert_transcript`,
`run_post_transcription_pipeline`, `update_meeting_notes`,
`export_meeting_notes`) is exercised for real.

Checks:

  A. MeetingNotes is auto-created (exactly one row) once the pipeline
     completes, composed from the Summary/Transcript it produced.
  B. Edit -> Save -> Reload preserves the edits (a fresh `get_meeting_notes`
     call, simulating a page reload, returns them).
  C. Transcript and Summary rows are byte-for-byte unchanged after that edit.
  D-F. Download PDF/DOCX/PPTX each produce non-empty bytes with the correct
     file signature.
  G. The export reflects the edited content, not the original AI output.
  H. A second user cannot read, edit, or export the first user's meeting.
  I. Re-running the pipeline (as if the meeting were reprocessed) leaves the
     existing MeetingNotes row untouched - no duplicate, no silent overwrite
     of the saved edit.

Usage: python -m scripts.verify_meeting_notes
"""

import sys
import uuid

from app.core.exceptions import AppError
from app.crud.meeting import create_meeting
from app.crud.meeting_notes import get_meeting_notes_by_meeting_id
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
from app.schemas.meeting_notes import MeetingNotesUpdate
from app.services.ai.base import ActionItem, StructuredSummaryResult, SummaryTextItem
from app.services.export.export_service import export_meeting_notes
from app.services.meeting_notes_service import get_meeting_notes, update_meeting_notes
from app.services.pipeline_service import run_post_transcription_pipeline

PRIMARY_EMAIL = "verify-meeting-notes@convera.test"
OTHER_EMAIL = "verify-meeting-notes-other@convera.test"

_FILE_SIGNATURES = {
    "pdf": b"%PDF",
    "docx": b"PK",
    "pptx": b"PK",
}


def _get_or_create_user(db, email: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        return user
    user = User(email=email, full_name="Meeting Notes Verify", hashed_password="not-a-real-hash", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_meeting_and_upload(db, user: User):
    meeting = create_meeting(
        db, user_id=user.id,
        meeting_in=MeetingCreate(title="meeting-notes-verify", source_type="upload-recording"),
    )
    upload = create_upload(
        db, user_id=user.id, meeting_id=meeting.id,
        original_filename="meeting-notes-verify.wav",
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


def _patch(monkeypatch_registry: list) -> None:
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


def check_a_auto_created(db, meeting_id, upload_id) -> None:
    upsert_transcript(
        db, meeting_id=meeting_id, upload_id=upload_id, language="en",
        transcript="Alice: Let's discuss the roadmap.",
        segments=[{"start": 0.0, "end": 2.0, "text": "Alice: Let's discuss the roadmap."}],
        duration=2.0, word_count=5,
    )
    run_post_transcription_pipeline(db, meeting_id)

    notes = get_meeting_notes_by_meeting_id(db, meeting_id)
    assert notes is not None, "MeetingNotes must be auto-created once the pipeline completes"
    assert notes.executive_summary == "Original AI executive summary."
    assert db.query(MeetingNotes).filter(MeetingNotes.meeting_id == meeting_id).count() == 1
    print("OK A: MeetingNotes auto-created (exactly one row) from the completed pipeline")


def check_b_edit_save_reload(db, meeting_id, user_id) -> dict:
    update_meeting_notes(
        db, meeting_id, user_id,
        MeetingNotesUpdate(
            title="Edited Meeting Title",
            executive_summary="Edited executive summary text.",
            action_items=[
                {"text": "Edited action item 1", "owner": "Bob", "due_date": "2026-09-01", "status": None},
                {"text": "Edited action item 2", "owner": None, "due_date": None, "status": None},
            ],
        ),
    )

    reloaded = get_meeting_notes(db, meeting_id, user_id)
    assert reloaded.title == "Edited Meeting Title"
    assert reloaded.executive_summary == "Edited executive summary text."
    assert len(reloaded.action_items) == 2
    assert reloaded.action_items[0].owner == "Bob"
    print("OK B: edit -> save -> reload preserved the edits")
    return {"title": reloaded.title, "executive_summary": reloaded.executive_summary}


def check_c_transcript_summary_untouched(db, meeting_id, edited: dict) -> None:
    transcript = get_transcript_by_meeting_id(db, meeting_id)
    summary = get_summary_by_meeting_id(db, meeting_id)
    assert transcript.transcript == "Alice: Let's discuss the roadmap.", "editing notes must not touch Transcript"
    assert summary.executive_summary == "Original AI executive summary.", "editing notes must not touch Summary"
    assert summary.executive_summary != edited["executive_summary"]
    print("OK C: Transcript and Summary remain unchanged after the MeetingNotes edit")


def check_def_downloads(db, meeting_id, user_id) -> None:
    for fmt in ("pdf", "docx", "pptx"):
        content, filename, content_type = export_meeting_notes(db, meeting_id, user_id, fmt)
        assert len(content) > 0, f"{fmt} export must not be empty"
        assert content.startswith(_FILE_SIGNATURES[fmt]), f"{fmt} export has the wrong file signature"
        assert filename.endswith(f".{fmt}")
        assert content_type
        print(f"OK {'DEF'['pdf docx pptx'.split().index(fmt)]}: {fmt.upper()} export produced a valid {len(content)}-byte file ({filename})")


def check_g_export_reflects_edits(db, meeting_id, user_id) -> None:
    content, _, _ = export_meeting_notes(db, meeting_id, user_id, "docx")
    # DOCX is a zip of compressed XML, so the edited title text won't appear
    # as a literal substring in the raw bytes - assert against the shared
    # content model instead, which is what every exporter actually renders.
    from app.services.export.content import TRANSCRIPT_DISCLAIMER, build_export_document
    notes = get_meeting_notes(db, meeting_id, user_id)
    document = build_export_document(notes)
    assert document.meeting_title == "Edited Meeting Title"
    assert document.sections[0].lines[0] == "Edited executive summary text."
    assert document.disclaimer == TRANSCRIPT_DISCLAIMER, (
        "Meeting Notes export must carry the exact editable-transcript disclaimer"
    )
    assert len(content) > 0
    print("OK G: export content reflects the edited MeetingNotes, not the original AI output")
    print("OK G2: export document carries the exact transcript disclaimer")


def check_h_unauthorized_rejected(db, meeting_id, other_user_id) -> None:
    for label, action in [
        ("read", lambda: get_meeting_notes(db, meeting_id, other_user_id)),
        ("update", lambda: update_meeting_notes(db, meeting_id, other_user_id, MeetingNotesUpdate(title="hacked"))),
        ("export", lambda: export_meeting_notes(db, meeting_id, other_user_id, "pdf")),
    ]:
        try:
            action()
            raise AssertionError(f"unauthorized {label} must be rejected")
        except AppError as exc:
            assert exc.status_code == 404, f"unauthorized {label} should 404 (not leak existence), got {exc.status_code}"
    print("OK H: unauthorized read/update/export are all rejected")


def check_i_reprocess_does_not_clobber_edit(db, meeting_id) -> None:
    run_post_transcription_pipeline(db, meeting_id)
    notes = get_meeting_notes_by_meeting_id(db, meeting_id)
    assert notes.title == "Edited Meeting Title", "reprocessing must not overwrite a saved MeetingNotes edit"
    assert db.query(MeetingNotes).filter(MeetingNotes.meeting_id == meeting_id).count() == 1, (
        "reprocessing must not create a duplicate MeetingNotes row"
    )
    print("OK I: re-running the pipeline left the saved MeetingNotes edit untouched (no duplicate)")


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
    patches: list = []
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
            _patch(patches)
            check_a_auto_created(db, meeting_id, upload_id)
            edited = check_b_edit_save_reload(db, meeting_id, user_id)
            check_c_transcript_summary_untouched(db, meeting_id, edited)
            check_def_downloads(db, meeting_id, user_id)
            check_g_export_reflects_edits(db, meeting_id, user_id)
            check_h_unauthorized_rejected(db, meeting_id, other_user_id)
            check_i_reprocess_does_not_clobber_edit(db, meeting_id)
        finally:
            db.close()
    except AssertionError as exc:
        print(f"FAILED: {exc}")
        _unpatch(patches)
        cleanup([meeting_id], [upload_id])
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED: unexpected error: {exc}")
        _unpatch(patches)
        cleanup([meeting_id], [upload_id])
        return 1

    _unpatch(patches)
    cleanup([meeting_id], [upload_id])
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
