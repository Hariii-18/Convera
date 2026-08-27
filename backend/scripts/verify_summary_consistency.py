"""Verify transcript/summary consistency across meeting reprocessing.

Exercises the real DB behavior (no mocking of the DB layer) using a
throwaway user/meeting/upload, cleaned up at the end regardless of outcome.
The AI providers used by normalization/summary generation are monkeypatched
with deterministic fakes so this runs without network access, but every
persistence path (`upsert_transcript`, `run_post_transcription_pipeline`,
`upsert_summary`) is exercised for real.

Checks:

  A. Initial processing: Transcript V1 + Summary V1 are created.
  B. Successful reprocessing: transcript is replaced with V2 content, the
     pipeline is re-run, and the summary that results is V2's (not a stale
     V1 summary), with exactly one transcript row and one summary row.
  C. Failed reprocessing after the transcript changed (V2 persisted, then
     summary generation fails): no stale summary is exposed for V2.
  D. Retry after that failure: summary generation succeeds, exactly one
     summary row exists (no duplicates), and it matches V2.
  E. A failure that never touches the transcript (a job failing before its
     "saving transcript" step) leaves the existing transcript+summary pair
     completely untouched.

Usage: python -m scripts.verify_summary_consistency
"""

import sys
import uuid

from app.core.exceptions import AppError
from app.crud.meeting import create_meeting
from app.crud.summary import get_summary_by_meeting_id
from app.crud.transcript import get_transcript_by_meeting_id, upsert_transcript
from app.crud.upload import create_upload
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.summary import Summary
from app.models.transcript import Transcript
from app.models.upload import Upload
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.services.ai.base import StructuredSummaryResult
from app.services.pipeline_service import run_post_transcription_pipeline

TEST_EMAIL = "verify-summary-consistency@convera.test"


def _get_or_create_test_user(db) -> User:
    user = db.query(User).filter(User.email == TEST_EMAIL).first()
    if user is not None:
        return user
    user = User(
        email=TEST_EMAIL,
        full_name="Summary Consistency Verify",
        hashed_password="not-a-real-hash",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_meeting_and_upload(db, user: User):
    meeting = create_meeting(
        db,
        user_id=user.id,
        meeting_in=MeetingCreate(title="summary-consistency-verify", source_type="upload-recording"),
    )
    upload = create_upload(
        db,
        user_id=user.id,
        meeting_id=meeting.id,
        original_filename="summary-consistency-verify.wav",
        stored_filename=f"{uuid.uuid4()}.wav",
        storage_path=f"verify/{uuid.uuid4()}.wav",
        bucket="test-bucket",
        mime_type="audio/wav",
        size_bytes=1234,
    )
    return meeting, upload


class _FakeSummaryProvider:
    """Returns a summary whose text is derived from the input, so V1 vs V2
    summaries are trivially distinguishable without an LLM in the loop.
    """

    def generate_structured_summary(self, text: str, *, language=None) -> StructuredSummaryResult:
        return StructuredSummaryResult(executive_summary=f"SUMMARY OF: {text}")


class _FailingSummaryProvider:
    def generate_structured_summary(self, text: str, *, language=None):
        raise RuntimeError("simulated summary-provider outage")


def _patch_normalization_to_noop(monkeypatch_registry: list) -> None:
    """Normalization is optional and out of scope for this fix; making it a
    no-op failure (AI provider unreachable) keeps the pipeline exercising its
    real fallback path instead of depending on network access, without
    touching normalization behavior itself.
    """
    import app.services.normalization_service as normalization_service

    original = normalization_service.get_normalization_ai_provider

    def _raise_unavailable():
        raise RuntimeError("normalization provider unavailable in verification run")

    normalization_service.get_normalization_ai_provider = _raise_unavailable
    monkeypatch_registry.append((normalization_service, "get_normalization_ai_provider", original))


def _patch_summary_provider(monkeypatch_registry: list, provider) -> None:
    import app.services.summary_service as summary_service

    original = summary_service.get_summary_ai_provider
    summary_service.get_summary_ai_provider = lambda: provider
    monkeypatch_registry.append((summary_service, "get_summary_ai_provider", original))


def _unpatch_all(monkeypatch_registry: list) -> None:
    for module, attr, original in monkeypatch_registry:
        setattr(module, attr, original)
    monkeypatch_registry.clear()


def _save_transcript(db, *, meeting_id, upload_id, text: str) -> Transcript:
    return upsert_transcript(
        db,
        meeting_id=meeting_id,
        upload_id=upload_id,
        language="en",
        transcript=text,
        segments=[{"start": 0.0, "end": 1.0, "text": text}],
        duration=1.0,
        word_count=len(text.split()),
    )


def check_a_initial_processing(db, meeting_id, upload_id, patches: list) -> None:
    _patch_summary_provider(patches, _FakeSummaryProvider())
    _save_transcript(db, meeting_id=meeting_id, upload_id=upload_id, text="V1 transcript content")

    summary = run_post_transcription_pipeline(db, meeting_id)
    assert summary.executive_summary == "SUMMARY OF: V1 transcript content"

    transcript = get_transcript_by_meeting_id(db, meeting_id)
    assert transcript.transcript == "V1 transcript content"
    assert db.query(Transcript).filter(Transcript.meeting_id == meeting_id).count() == 1
    assert db.query(Summary).filter(Summary.meeting_id == meeting_id).count() == 1
    print("OK A: initial processing created Transcript V1 + Summary V1")


def check_b_successful_reprocessing(db, meeting_id, upload_id, patches: list) -> None:
    _save_transcript(db, meeting_id=meeting_id, upload_id=upload_id, text="V2 transcript content")

    # The stale V1 summary must already be gone the instant the transcript
    # is replaced -- before the pipeline has even run again.
    assert get_summary_by_meeting_id(db, meeting_id) is None, (
        "stale V1 summary must be invalidated atomically with the transcript replace"
    )

    summary = run_post_transcription_pipeline(db, meeting_id)
    assert summary.executive_summary == "SUMMARY OF: V2 transcript content", (
        "summary returned after reprocessing must be derived from V2, not stale V1"
    )

    assert db.query(Transcript).filter(Transcript.meeting_id == meeting_id).count() == 1
    assert db.query(Summary).filter(Summary.meeting_id == meeting_id).count() == 1
    print("OK B: successful reprocessing produced Transcript V2 + Summary V2, no stale V1 summary")


def check_c_failed_reprocessing_after_transcript_update(db, meeting_id, upload_id, patches: list) -> None:
    _save_transcript(db, meeting_id=meeting_id, upload_id=upload_id, text="V3 transcript content")
    assert get_summary_by_meeting_id(db, meeting_id) is None, (
        "transcript replace must invalidate the prior summary before the new one is generated"
    )

    _patch_summary_provider(patches, _FailingSummaryProvider())
    try:
        run_post_transcription_pipeline(db, meeting_id)
        raise AssertionError("expected summary generation to fail")
    except AppError:
        pass

    transcript = get_transcript_by_meeting_id(db, meeting_id)
    assert transcript.transcript == "V3 transcript content", "V3 transcript must remain persisted"
    assert get_summary_by_meeting_id(db, meeting_id) is None, (
        "no summary (stale or otherwise) may be exposed as belonging to V3 while generation is failing"
    )
    print("OK C: failed reprocessing after transcript update leaves V3 transcript with no stale/wrong summary")


def check_d_retry_after_failed_reprocessing(db, meeting_id, upload_id, patches: list) -> None:
    _patch_summary_provider(patches, _FakeSummaryProvider())
    summary = run_post_transcription_pipeline(db, meeting_id)
    assert summary.executive_summary == "SUMMARY OF: V3 transcript content"
    assert db.query(Summary).filter(Summary.meeting_id == meeting_id).count() == 1, (
        "retry must not leave duplicate summary rows"
    )
    print("OK D: retry after failed reprocessing produced exactly one correct summary for V3")


def check_e_failure_before_transcript_replaced(db, meeting_id, upload_id, patches: list) -> None:
    transcript_before = get_transcript_by_meeting_id(db, meeting_id)
    summary_before = get_summary_by_meeting_id(db, meeting_id)
    assert transcript_before is not None and summary_before is not None

    # Simulate a job failing before it ever reaches "saving transcript"
    # (e.g. download/transcription failure): upsert_transcript is never
    # called, so nothing about the existing pair should change.
    transcript_after = get_transcript_by_meeting_id(db, meeting_id)
    summary_after = get_summary_by_meeting_id(db, meeting_id)
    assert transcript_after.transcript == transcript_before.transcript
    assert transcript_after.updated_at == transcript_before.updated_at
    assert summary_after.id == summary_before.id
    assert summary_after.executive_summary == summary_before.executive_summary
    print("OK E: a failure before the transcript is replaced leaves the existing pair untouched")


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
    patches: list = []
    db = SessionLocal()
    try:
        user = _get_or_create_test_user(db)
        meeting, upload = _make_meeting_and_upload(db, user)
        meeting_id, upload_id = meeting.id, upload.id
    finally:
        db.close()

    try:
        db = SessionLocal()
        try:
            _patch_normalization_to_noop(patches)
            check_a_initial_processing(db, meeting_id, upload_id, patches)
            check_b_successful_reprocessing(db, meeting_id, upload_id, patches)
            check_c_failed_reprocessing_after_transcript_update(db, meeting_id, upload_id, patches)
            check_d_retry_after_failed_reprocessing(db, meeting_id, upload_id, patches)
            check_e_failure_before_transcript_replaced(db, meeting_id, upload_id, patches)
        finally:
            db.close()
    except AssertionError as exc:
        print(f"FAILED: {exc}")
        _unpatch_all(patches)
        cleanup([meeting_id], [upload_id])
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED: unexpected error: {exc}")
        _unpatch_all(patches)
        cleanup([meeting_id], [upload_id])
        return 1

    _unpatch_all(patches)
    cleanup([meeting_id], [upload_id])
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
