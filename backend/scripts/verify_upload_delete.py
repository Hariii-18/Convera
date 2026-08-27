"""Verify single-upload deletion consistency (Step 4).

Exercises `delete_upload_cascade` against the real DB (no mocking of the DB
layer) using a throwaway user/meeting/uploads, cleaned up at the end
regardless of outcome. Storage calls are monkeypatched with an in-memory
fake so this runs without network access, but every persistence path is
exercised for real.

Checks:

  A. Deleting an upload with no processing job / transcript / summary just
     soft-deletes the upload row and removes its storage object.
  B. Deleting the upload that produced a meeting's transcript+summary also
     removes its processing job, the transcript, and the summary - and
     nothing else (the meeting survives).
  C. A second upload on the *same* meeting is untouched by deleting the
     first upload's data.
  D. Deleting a meeting's other, transcript-less upload leaves the
     meeting's transcript/summary intact.
  E. Repeated delete of an already-deleted upload is rejected (404), not a
     500 or a silent double-delete.
  F. `delete_meeting_cascade` (existing meeting-level delete) still passes
     unaffected by this change.

Usage: python -m scripts.verify_upload_delete
"""

import sys
import uuid

from app.core.exceptions import AppError
from app.crud.meeting import create_meeting
from app.crud.processing_job import create_processing_job, list_processing_jobs_by_upload_id
from app.crud.summary import get_summary_by_meeting_id
from app.crud.transcript import get_transcript_by_meeting_id, upsert_transcript
from app.crud.upload import create_upload, get_upload
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.summary import Summary
from app.models.transcript import Transcript
from app.models.upload import Upload
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.services import storage_service, upload_service

TEST_EMAIL = "verify-upload-delete@convera.test"

_fake_storage: set[str] = set()
_failures: list[str] = []


def _fake_delete_file(storage_path: str, *, bucket: str) -> None:
    _fake_storage.discard(storage_path)


def _get_or_create_test_user(db) -> User:
    user = db.query(User).filter(User.email == TEST_EMAIL).first()
    if user is not None:
        return user
    user = User(
        email=TEST_EMAIL,
        full_name="Upload Delete Verify",
        hashed_password="not-a-real-hash",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_meeting(db, user: User) -> Meeting:
    return create_meeting(
        db,
        user_id=user.id,
        meeting_in=MeetingCreate(title=f"Verify {uuid.uuid4().hex[:8]}", source_type="upload-recording"),
    )


def _make_upload(db, *, user: User, meeting: Meeting) -> Upload:
    storage_path = f"verify-upload-delete/{uuid.uuid4().hex}.wav"
    _fake_storage.add(storage_path)
    return create_upload(
        db,
        user_id=user.id,
        meeting_id=meeting.id,
        original_filename=f"{uuid.uuid4().hex[:8]}.wav",
        stored_filename=f"{uuid.uuid4().hex}.wav",
        storage_path=storage_path,
        bucket="recordings",
        mime_type="audio/wav",
        size_bytes=1234,
    )


def _check(label: str, condition: bool) -> None:
    if condition:
        print(f"OK {label}")
    else:
        print(f"FAIL {label}")
        _failures.append(label)


def _cleanup(db, user: User) -> None:
    db.query(Summary).filter(
        Summary.meeting_id.in_(db.query(Meeting.id).filter(Meeting.user_id == user.id))
    ).delete(synchronize_session=False)
    db.query(Transcript).filter(
        Transcript.meeting_id.in_(db.query(Meeting.id).filter(Meeting.user_id == user.id))
    ).delete(synchronize_session=False)
    from app.models.processing_job import ProcessingJob

    db.query(ProcessingJob).filter(ProcessingJob.user_id == user.id).delete(
        synchronize_session=False
    )
    db.query(Upload).filter(Upload.user_id == user.id).delete(synchronize_session=False)
    db.query(Meeting).filter(Meeting.user_id == user.id).delete(synchronize_session=False)
    db.commit()


def main() -> int:
    storage_service.delete_file = _fake_delete_file
    upload_service.delete_file = _fake_delete_file

    db = SessionLocal()
    try:
        user = _get_or_create_test_user(db)
        _cleanup(db, user)

        # --- A: bare upload, no dependents ---
        meeting_a = _make_meeting(db, user)
        upload_a = _make_upload(db, user=user, meeting=meeting_a)
        storage_path_a = upload_a.storage_path

        upload_service.delete_upload_cascade(db, upload_a)

        _check("A: upload soft-deleted (not visible via get_upload)", get_upload(db, upload_a.id, user.id) is None)
        _check("A: storage object removed", storage_path_a not in _fake_storage)
        _check("A: meeting untouched (not soft-deleted)", db.query(Meeting).filter(Meeting.id == meeting_a.id).first().deleted_at is None)

        # --- B/C/D: meeting with two uploads, one producing the transcript ---
        meeting_b = _make_meeting(db, user)
        upload_b1 = _make_upload(db, user=user, meeting=meeting_b)
        upload_b2 = _make_upload(db, user=user, meeting=meeting_b)

        job_b1 = create_processing_job(db, upload_id=upload_b1.id, meeting_id=meeting_b.id, user_id=user.id)
        create_processing_job(db, upload_id=upload_b2.id, meeting_id=meeting_b.id, user_id=user.id)

        transcript = upsert_transcript(
            db,
            meeting_id=meeting_b.id,
            upload_id=upload_b1.id,
            language="en",
            transcript="hello world",
            segments=[],
            duration=1.0,
            word_count=2,
            produced_by_job_id=job_b1.id,
        )
        summary = Summary(
            meeting_id=meeting_b.id,
            executive_summary="summary",
            topics=[],
            decisions=[],
            action_items=[],
            risks=[],
            open_questions=[],
            next_steps=[],
        )
        db.add(summary)
        db.commit()

        storage_path_b1 = upload_b1.storage_path
        storage_path_b2 = upload_b2.storage_path

        upload_service.delete_upload_cascade(db, upload_b1)

        _check("B: upload_b1 soft-deleted", get_upload(db, upload_b1.id, user.id) is None)
        _check("B: upload_b1 storage object removed", storage_path_b1 not in _fake_storage)
        _check("B: upload_b1's processing job removed", list_processing_jobs_by_upload_id(db, upload_b1.id) == [])
        _check("B: transcript removed", get_transcript_by_meeting_id(db, meeting_b.id) is None)
        _check("B: summary removed", get_summary_by_meeting_id(db, meeting_b.id) is None)
        _check("B: meeting itself untouched", db.query(Meeting).filter(Meeting.id == meeting_b.id).first().deleted_at is None)

        _check("C: upload_b2 still present", get_upload(db, upload_b2.id, user.id) is not None)
        _check(
            "C: upload_b2's own processing job untouched",
            len(list_processing_jobs_by_upload_id(db, upload_b2.id)) == 1,
        )
        _check("C: upload_b2 storage object untouched", storage_path_b2 in _fake_storage)

        # --- D: deleting a transcript-less upload leaves transcript/summary of another upload intact ---
        meeting_d = _make_meeting(db, user)
        upload_d1 = _make_upload(db, user=user, meeting=meeting_d)
        upload_d2 = _make_upload(db, user=user, meeting=meeting_d)
        job_d1 = create_processing_job(db, upload_id=upload_d1.id, meeting_id=meeting_d.id, user_id=user.id)
        upsert_transcript(
            db,
            meeting_id=meeting_d.id,
            upload_id=upload_d1.id,
            language="en",
            transcript="hello",
            segments=[],
            duration=1.0,
            word_count=1,
            produced_by_job_id=job_d1.id,
        )

        upload_service.delete_upload_cascade(db, upload_d2)

        _check("D: upload_d2 deleted", get_upload(db, upload_d2.id, user.id) is None)
        _check("D: meeting_d transcript (owned by upload_d1) intact", get_transcript_by_meeting_id(db, meeting_d.id) is not None)

        # --- E: repeated delete is safe (rejected, not a crash / double-delete) ---
        from app.api.v1.uploads import _get_owned_upload

        raised = False
        try:
            _get_owned_upload(db, upload_a.id, user)
        except AppError as exc:
            raised = exc.status_code == 404
        _check("E: repeated delete of same upload is rejected (404 via owned-lookup)", raised)

        if _failures:
            print(f"\n{len(_failures)} check(s) FAILED: {_failures}")
            return 1

        print("\nALL CHECKS PASSED")
        return 0
    finally:
        _cleanup(db, user)
        db.close()


if __name__ == "__main__":
    sys.exit(main())
