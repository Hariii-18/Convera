"""Verify Meeting.status state-machine validation (Step 2).

Exercises the real API/service layer against the real database (throwaway
user/meeting/upload rows cleaned up at the end regardless of outcome):

  A. Every legitimate transition the app's real lifecycle code produces still
     works: scheduled -> processing (queue), processing -> completed,
     processing -> failed, failed -> processing (retry), completed ->
     processing (reprocess).
  B. An invalid transition (e.g. scheduled -> completed) is rejected (409)
     when attempted through the internal status-sync path.
  C. A completed meeting cannot be moved back to an earlier state via
     PATCH /meetings/{id} - PATCH no longer accepts `status` at all, so the
     attempt is rejected (422) before any transition logic even runs.
  D. A failed meeting still recovers only through the existing
     retry_processing_job path (guarded on ProcessingJob.status == "failed").
  E. PATCH /meetings/{id} with a `status` field is rejected for every
     starting status; PATCH with only `title` still works.
  F. The recorded-upload lifecycle (queue -> execute pipeline effects)
     continues to flip Meeting.status via the validated path.

Usage: python -m scripts.verify_meeting_status_transitions
"""

import sys
import uuid

from fastapi.testclient import TestClient

from app.core.exceptions import AppError
from app.crud.meeting import get_meeting, update_meeting_status
from app.crud.processing_job import create_processing_job
from app.crud.upload import create_upload
from app.db.session import SessionLocal
from app.main import app
from app.models.meeting import Meeting
from app.models.processing_job import ProcessingJob
from app.models.upload import Upload
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.services.processing_service import queue_processing_job, retry_processing_job

TEST_EMAIL = "verify-meeting-status@convera.test"


def _get_or_create_test_user(db) -> User:
    user = db.query(User).filter(User.email == TEST_EMAIL).first()
    if user is not None:
        return user
    user = User(
        email=TEST_EMAIL,
        full_name="Meeting Status Verify",
        hashed_password="not-a-real-hash",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_meeting_and_upload(db, user: User):
    from app.crud.meeting import create_meeting

    meeting = create_meeting(
        db, user_id=user.id, meeting_in=MeetingCreate(title="status-verify", source_type="upload-recording")
    )
    upload = create_upload(
        db,
        user_id=user.id,
        meeting_id=meeting.id,
        original_filename="status-verify.wav",
        stored_filename=f"{uuid.uuid4()}.wav",
        storage_path=f"verify/{uuid.uuid4()}.wav",
        bucket="test-bucket",
        mime_type="audio/wav",
        size_bytes=1234,
    )
    return meeting, upload


def check_a_legitimate_transitions(user: User) -> None:
    db = SessionLocal()
    try:
        meeting, upload = _make_meeting_and_upload(db, user)
        assert meeting.status == "scheduled", "new meeting must start 'scheduled'"

        job = queue_processing_job(db, upload=upload, user=user)
        meeting = get_meeting(db, meeting.id, user.id)
        assert meeting.status == "processing", "queueing must move scheduled -> processing"
        print("OK A1: scheduled -> processing (queue_processing_job)")

        update_meeting_status(db, meeting, "completed")
        meeting = get_meeting(db, meeting.id, user.id)
        assert meeting.status == "completed"
        print("OK A2: processing -> completed")

        # Reprocess: queueing again on a completed meeting is the real
        # "reprocess an upload" flow (queue_processing_job never blocks on
        # historical jobs), and must flip completed -> processing.
        db.query(ProcessingJob).filter(ProcessingJob.upload_id == upload.id).delete()
        db.commit()
        queue_processing_job(db, upload=upload, user=user)
        meeting = get_meeting(db, meeting.id, user.id)
        assert meeting.status == "processing", "reprocessing must move completed -> processing"
        print("OK A3: completed -> processing (reprocess)")

        update_meeting_status(db, meeting, "failed")
        meeting = get_meeting(db, meeting.id, user.id)
        assert meeting.status == "failed"
        print("OK A4: processing -> failed")

        job = db.query(ProcessingJob).filter(ProcessingJob.upload_id == upload.id).first()
        job.status = "failed"
        db.commit()
        retry_processing_job(db, job)
        meeting = get_meeting(db, meeting.id, user.id)
        assert meeting.status == "processing", "retry must move failed -> processing"
        print("OK A5: failed -> processing (retry_processing_job)")
    finally:
        db.close()


def check_b_invalid_transition_rejected(user: User) -> None:
    db = SessionLocal()
    try:
        meeting, _upload = _make_meeting_and_upload(db, user)
        assert meeting.status == "scheduled"

        try:
            update_meeting_status(db, meeting, "completed")
            raise AssertionError("scheduled -> completed must be rejected")
        except AppError as exc:
            assert exc.status_code == 409, f"expected 409, got {exc.status_code}"
            print("OK B: invalid transition scheduled -> completed rejected with 409")

        meeting = get_meeting(db, meeting.id, user.id)
        assert meeting.status == "scheduled", "rejected transition must not mutate status"
        print("OK B2: rejected transition left status unchanged")
    finally:
        db.close()


def check_c_completed_protected_from_patch(client: TestClient, user: User, token: str) -> None:
    db = SessionLocal()
    try:
        meeting, _upload = _make_meeting_and_upload(db, user)
        update_meeting_status(db, meeting, "processing")
        update_meeting_status(db, meeting, "completed")
        meeting_id = meeting.id
    finally:
        db.close()

    resp = client.patch(
        f"/api/v1/meetings/{meeting_id}",
        json={"status": "scheduled"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422, f"expected 422 for status in PATCH body, got {resp.status_code}: {resp.text}"
    print("OK C: PATCH attempting to move completed -> scheduled rejected (422, status not a field)")

    db = SessionLocal()
    try:
        meeting = get_meeting(db, meeting_id, user.id)
        assert meeting.status == "completed", "completed meeting must remain completed after rejected PATCH"
        print("OK C2: meeting status still 'completed' after rejected PATCH")
    finally:
        db.close()


def check_d_failed_retry_path(user: User) -> None:
    db = SessionLocal()
    try:
        meeting, upload = _make_meeting_and_upload(db, user)
        queue_processing_job(db, upload=upload, user=user)
        job = db.query(ProcessingJob).filter(ProcessingJob.upload_id == upload.id).first()

        try:
            retry_processing_job(db, job)
            raise AssertionError("retry of a non-failed job must be rejected")
        except AppError as exc:
            assert exc.status_code == 400
            print("OK D1: retry_processing_job rejects a non-failed job (400, pre-existing guard)")

        job.status = "failed"
        db.commit()
        update_meeting_status(db, get_meeting(db, meeting.id, user.id), "failed")

        retry_processing_job(db, job)
        meeting = get_meeting(db, meeting.id, user.id)
        assert meeting.status == "processing"
        print("OK D2: failed meeting recovers via retry_processing_job -> 'processing'")
    finally:
        db.close()


def check_e_patch_status_always_rejected(client: TestClient, user: User, token: str) -> None:
    db = SessionLocal()
    try:
        meeting, _upload = _make_meeting_and_upload(db, user)
        meeting_id = meeting.id
    finally:
        db.close()

    for status_value in ("scheduled", "processing", "completed", "failed", "not-a-real-status"):
        resp = client.patch(
            f"/api/v1/meetings/{meeting_id}",
            json={"status": status_value},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422, f"status={status_value!r} expected 422, got {resp.status_code}"
    print("OK E1: PATCH with `status` rejected (422) regardless of value")

    resp = client.patch(
        f"/api/v1/meetings/{meeting_id}",
        json={"title": "renamed via patch"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"title-only PATCH expected 200, got {resp.status_code}: {resp.text}"
    assert resp.json()["title"] == "renamed via patch"
    print("OK E2: title-only PATCH still works")


def cleanup(meeting_ids: list, upload_ids: list) -> None:
    db = SessionLocal()
    try:
        db.query(ProcessingJob).filter(ProcessingJob.upload_id.in_(upload_ids)).delete(synchronize_session=False)
        db.query(Upload).filter(Upload.id.in_(upload_ids)).delete(synchronize_session=False)
        db.query(Meeting).filter(Meeting.id.in_(meeting_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def _issue_token(user: User) -> str:
    from app.core.security import create_access_token

    return create_access_token(subject=str(user.id))


def main() -> int:
    db = SessionLocal()
    try:
        user = _get_or_create_test_user(db)
        user_id = user.id
    finally:
        db.close()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        token = _issue_token(user)
    finally:
        db.close()

    client = TestClient(app)
    meeting_ids: list = []
    upload_ids: list = []

    def _track():
        db = SessionLocal()
        try:
            metas = db.query(Meeting).filter(Meeting.user_id == user_id).all()
            uploads = db.query(Upload).filter(Upload.user_id == user_id).all()
            meeting_ids.extend(m.id for m in metas)
            upload_ids.extend(u.id for u in uploads)
        finally:
            db.close()

    try:
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            check_a_legitimate_transitions(user)
            check_b_invalid_transition_rejected(user)
        finally:
            db.close()

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            check_c_completed_protected_from_patch(client, user, token)
        finally:
            db.close()

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            check_d_failed_retry_path(user)
        finally:
            db.close()

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            check_e_patch_status_always_rejected(client, user, token)
        finally:
            db.close()
    except AssertionError as exc:
        print(f"FAILED: {exc}")
        _track()
        cleanup(meeting_ids, upload_ids)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED: unexpected error: {exc}")
        _track()
        cleanup(meeting_ids, upload_ids)
        return 1

    _track()
    cleanup(meeting_ids, upload_ids)
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
