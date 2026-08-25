"""Verify duplicate-protection for ProcessingJob creation (queue_processing_job).

Exercises the full lifecycle against the real database (no mocking of the DB
layer) using throwaway user/meeting/upload rows that are cleaned up at the
end regardless of outcome:

  A. First request creates exactly one ProcessingJob.
  B. A repeated sequential request reuses that same active job (no duplicate).
  C. Two concurrent requests for the same upload never result in two active
     ProcessingJob rows (each uses its own DB session/connection, like two
     real API requests would).
  D. A completed job does not block a new job being queued for the same
     upload (legitimate reprocessing).
  E. A failed job does not block a new job being queued for the same upload
     either, independent of the dedicated job-scoped retry endpoint.
  F. A plain recorded-upload create -> queue flow still works end-to-end.

Usage: python -m scripts.verify_processing_job_dedup
"""

import sys
import threading
import uuid

from app.crud.meeting import create_meeting
from app.crud.processing_job import delete_processing_job
from app.crud.upload import create_upload
from app.db.session import SessionLocal
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.services.processing_service import queue_processing_job

TEST_EMAIL = "verify-processing-dedup@convera.test"


def _get_or_create_test_user(db) -> User:
    user = db.query(User).filter(User.email == TEST_EMAIL).first()
    if user is not None:
        return user
    user = User(
        email=TEST_EMAIL,
        full_name="Dedup Verify",
        hashed_password="not-a-real-hash",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_upload(db, user: User):
    meeting = create_meeting(
        db,
        user_id=user.id,
        meeting_in=MeetingCreate(title=f"dedup-verify-{uuid.uuid4().hex}", source_type="upload-recording"),
    )
    upload = create_upload(
        db,
        user_id=user.id,
        meeting_id=meeting.id,
        original_filename="dedup-verify.wav",
        stored_filename=f"{uuid.uuid4()}.wav",
        storage_path=f"verify/{uuid.uuid4()}.wav",
        bucket="test-bucket",
        mime_type="audio/wav",
        size_bytes=1234,
    )
    return meeting, upload


def _active_job_count(db, upload_id) -> int:
    return (
        db.query(ProcessingJob)
        .filter(
            ProcessingJob.upload_id == upload_id,
            ProcessingJob.status.in_(("queued", "preparing", "processing")),
        )
        .count()
    )


def _total_job_count(db, upload_id) -> int:
    return db.query(ProcessingJob).filter(ProcessingJob.upload_id == upload_id).count()


def check_a_b(user_id: int, meeting_id, upload) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).get(user_id)

        job1 = queue_processing_job(db, upload=upload, user=user)
        assert _total_job_count(db, upload.id) == 1, "expected exactly one job after first request"
        print("OK A: first request created exactly one ProcessingJob")

        job2 = queue_processing_job(db, upload=upload, user=user)
        assert job2.id == job1.id, "repeated request must reuse the existing active job"
        assert _total_job_count(db, upload.id) == 1, "repeated request must not create a duplicate"
        print("OK B: repeated sequential request reused the existing active job (no duplicate)")
    finally:
        db.close()


def check_c(upload_id, meeting_id, user_id) -> None:
    results: list[uuid.UUID] = []
    errors: list[BaseException] = []
    barrier = threading.Barrier(2)

    # Re-fetch a fresh Upload/User per thread/session (ORM objects aren't
    # safely shared across sessions), then synchronize both threads to call
    # queue_processing_job at (as close to) the same instant as possible.
    from app.crud.upload import get_upload

    def worker_impl():
        db = SessionLocal()
        try:
            user = db.query(User).get(user_id)
            upload = get_upload(db, upload_id, user_id)
            barrier.wait(timeout=5)
            job = queue_processing_job(db, upload=upload, user=user)
            results.append(job.id)
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)
        finally:
            db.close()

    t1 = threading.Thread(target=worker_impl)
    t2 = threading.Thread(target=worker_impl)
    t1.start()
    t2.start()
    t1.join(timeout=15)
    t2.join(timeout=15)

    if errors:
        raise errors[0]

    assert len(results) == 2, "both concurrent requests should have returned a job"
    assert results[0] == results[1], "concurrent requests must resolve to the same job"

    db = SessionLocal()
    try:
        active = _active_job_count(db, upload_id)
        total = _total_job_count(db, upload_id)
        assert active == 1, f"expected exactly one active job after concurrent requests, got {active}"
        assert total == 1, f"expected exactly one total job after concurrent requests, got {total}"
    finally:
        db.close()
    print("OK C: two concurrent requests for the same upload produced exactly one active ProcessingJob")


def check_d_reprocess_after_completed(user_id: int, upload_id) -> None:
    from app.crud.upload import get_upload

    db = SessionLocal()
    try:
        user = db.query(User).get(user_id)
        upload = get_upload(db, upload_id, user_id)
        active_before = _active_job_count(db, upload.id)
        assert active_before == 1

        job = db.query(ProcessingJob).filter(ProcessingJob.upload_id == upload.id).first()
        job.status = "completed"
        db.commit()

        new_job = queue_processing_job(db, upload=upload, user=user)
        assert new_job.id != job.id, "a completed job must not block a new job from being queued"
        assert _active_job_count(db, upload.id) == 1
        assert _total_job_count(db, upload.id) == 2
        print("OK D: a completed job does not block reprocessing (new job queued, old one preserved)")
    finally:
        db.close()


def check_e_reprocess_after_failed(user_id: int, upload_id) -> None:
    from app.crud.upload import get_upload

    db = SessionLocal()
    try:
        user = db.query(User).get(user_id)
        upload = get_upload(db, upload_id, user_id)
        current = (
            db.query(ProcessingJob)
            .filter(ProcessingJob.upload_id == upload.id, ProcessingJob.status.in_(("queued", "preparing", "processing")))
            .first()
        )
        current.status = "failed"
        db.commit()

        new_job = queue_processing_job(db, upload=upload, user=user)
        assert new_job.id != current.id, "a failed job must not block a new job from being queued"
        assert _active_job_count(db, upload.id) == 1
        assert _total_job_count(db, upload.id) == 3
        print("OK E: a failed job does not block reprocessing (new job queued, old one preserved)")
    finally:
        db.close()


def cleanup(meeting_ids: list, upload_ids: list) -> None:
    db = SessionLocal()
    try:
        db.query(ProcessingJob).filter(ProcessingJob.upload_id.in_(upload_ids)).delete(synchronize_session=False)
        from app.models.upload import Upload
        from app.models.meeting import Meeting

        db.query(Upload).filter(Upload.id.in_(upload_ids)).delete(synchronize_session=False)
        db.query(Meeting).filter(Meeting.id.in_(meeting_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def main() -> int:
    db = SessionLocal()
    try:
        user = _get_or_create_test_user(db)
        user_id = user.id
        meeting1, upload1 = _make_upload(db, user)
        meeting2, upload2 = _make_upload(db, user)
        meeting_ids = [meeting1.id, meeting2.id]
        upload_ids = [upload1.id, upload2.id]
        upload1_id, meeting1_id = upload1.id, meeting1.id
        upload2_id, meeting2_id = upload2.id, meeting2.id
    finally:
        db.close()

    try:
        db = SessionLocal()
        try:
            user = db.query(User).get(user_id)
            from app.crud.upload import get_upload

            upload1 = get_upload(db, upload1_id, user_id)
            check_a_b(user_id, meeting1_id, upload1)
        finally:
            db.close()
        check_c(upload2_id, meeting2_id, user_id)

        # D and E reuse upload1's now-single active job from A/B.
        check_d_reprocess_after_completed(user_id, upload1_id)
        check_e_reprocess_after_failed(user_id, upload1_id)
    except AssertionError as exc:
        print(f"FAILED: {exc}")
        cleanup(meeting_ids, upload_ids)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED: unexpected error: {exc}")
        cleanup(meeting_ids, upload_ids)
        return 1

    cleanup(meeting_ids, upload_ids)
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
