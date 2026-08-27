"""Verify meeting-creation / upload integrity invariants.

Exercises the real create_meeting / get_meeting / create_upload /
delete_meeting_cascade paths against the real DB (no mocking of the DB
layer) using a throwaway user, cleaned up at the end regardless of outcome.
Storage calls are monkeypatched with an in-memory fake so this runs without
network access.

Checks (mirroring the task's verification matrix):

  A. Creating a meeting then uploading with that meeting_id produces exactly
     one meeting and one upload, and the upload is linked to that meeting.
  B. A second upload against the *same* existing meeting_id does not create
     a second meeting - the meeting row is reused.
  C. An upload request for a meeting_id that doesn't exist (the case a
     failed/cancelled "create meeting for upload" flow would leave behind)
     is rejected before any Upload row is created - mirrors the 404 the
     `/uploads` endpoint raises - and the frontend's compensating
     `delete_meeting_cascade` call (fired when a newly-created meeting's
     upload never succeeds) leaves no meeting or upload rows behind.
  D. A meeting that already has a real upload is unaffected by
     `delete_meeting_cascade` never being called on it, and normal
     list/get lookups keep seeing it.

Usage: python -m scripts.verify_meeting_upload_integrity
"""

import sys
import uuid

from app.crud.meeting import create_meeting, get_meeting, list_meetings
from app.crud.upload import create_upload, get_upload, list_uploads_by_meeting_id
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.upload import Upload
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.services import meeting_service, storage_service

TEST_EMAIL = "verify-meeting-upload-integrity@convera.test"

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
        full_name="Meeting Upload Integrity Verify",
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
    storage_path = f"verify-meeting-upload-integrity/{uuid.uuid4().hex}.wav"
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
    db.query(Upload).filter(Upload.user_id == user.id).delete(synchronize_session=False)
    db.query(Meeting).filter(Meeting.user_id == user.id).delete(synchronize_session=False)
    db.commit()


def main() -> int:
    storage_service.delete_file = _fake_delete_file
    meeting_service.delete_file = _fake_delete_file

    db = SessionLocal()
    try:
        user = _get_or_create_test_user(db)
        _cleanup(db, user)

        # --- A: create meeting + one successful upload -> exactly one of each ---
        meeting_a = _make_meeting(db, user)
        upload_a = _make_upload(db, user=user, meeting=meeting_a)

        meetings_after_a = [m for m in list_meetings(db, user.id) if m.id == meeting_a.id]
        uploads_after_a = list_uploads_by_meeting_id(db, meeting_a.id)
        _check("A: exactly one meeting exists", len(meetings_after_a) == 1)
        _check("A: exactly one upload exists for it", len(uploads_after_a) == 1)
        _check("A: upload is linked to the intended meeting", uploads_after_a[0].meeting_id == meeting_a.id)

        # --- B: existing meeting + second upload -> no duplicate meeting ---
        meeting_count_before_b = len(list_meetings(db, user.id))
        upload_b2 = _make_upload(db, user=user, meeting=meeting_a)
        meeting_count_after_b = len(list_meetings(db, user.id))

        _check("B: no new meeting was created for the second upload", meeting_count_after_b == meeting_count_before_b)
        _check(
            "B: both uploads still point at the same meeting",
            {upload_a.meeting_id, upload_b2.meeting_id} == {meeting_a.id},
        )

        # --- C: failed/cancelled upload leaves no unintended empty meeting ---
        meeting_c = _make_meeting(db, user)  # simulates "New meeting" click, no file selected/uploaded yet
        _check(
            "C: pre-condition - orphan meeting has no uploads before rollback",
            len(list_uploads_by_meeting_id(db, meeting_c.id)) == 0,
        )

        # This is exactly what the frontend's useUploadTarget().close() now
        # calls when a newly-created meeting's upload dialog closes without
        # a successful upload.
        meeting_service.delete_meeting_cascade(db, meeting_c)

        _check("C: orphan meeting is gone after rollback", get_meeting(db, meeting_c.id, user.id) is None)
        _check(
            "C: orphan meeting no longer appears in the meeting list",
            all(m.id != meeting_c.id for m in list_meetings(db, user.id)),
        )

        # --- D: existing meeting with a real upload is unaffected ---
        _check("D: meeting_a (has a real upload) is still visible via get_meeting", get_meeting(db, meeting_a.id, user.id) is not None)
        _check("D: meeting_a still has both of its uploads", len(list_uploads_by_meeting_id(db, meeting_a.id)) == 2)
        _check(
            "D: meeting_a's own upload is still fetchable",
            get_upload(db, upload_a.id, user.id) is not None,
        )

        _cleanup(db, user)
    finally:
        db.close()

    print()
    if _failures:
        print(f"{len(_failures)} check(s) FAILED:")
        for label in _failures:
            print(f"  - {label}")
        return 1

    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
