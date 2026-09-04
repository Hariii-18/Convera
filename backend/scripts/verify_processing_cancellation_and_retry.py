"""One-off diagnostic (not part of the standard verify_*.py suite) for the
Processing Performance Audit: confirms cancellation and retry still work
correctly after the pipeline restore + optimizations in this audit, and that
no transcription worker process is left running afterward.

A. Start a real processing job (via `execute_processing_job`, same as the
   benchmark harness) against a long enough clip that it's still inside the
   transcription child process when cancelled. Cancel it a couple seconds in.
B. Assert: job lands on "cancelled" (not "failed"), and the transcription
   worker's pid is no longer alive shortly after cancellation.
C. Retry a deliberately-failed job and confirm it moves back to "processing".

Usage: python -m scripts.verify_processing_cancellation_and_retry
"""

from __future__ import annotations

import asyncio
import io
import sys
import time
import uuid
import wave
from pathlib import Path
from unittest.mock import patch

TEST_EMAIL = "verify-cancel-retry@convera.test"
_REPO_ROOT = Path(__file__).resolve().parents[2]
_SOURCE_WAV = _REPO_ROOT / ".audit" / "test_meeting_multispeaker.wav"


def _build_wav(source: Path, loops: int) -> bytes:
    with wave.open(str(source), "rb") as w:
        params = w.getparams()
        frames = w.readframes(w.getnframes())
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setparams(params)
        for _ in range(loops):
            out.writeframes(frames)
    return buffer.getvalue()


def _get_or_create_test_user(db):
    from app.models.user import User

    user = db.query(User).filter(User.email == TEST_EMAIL).first()
    if user is not None:
        return user
    user = User(email=TEST_EMAIL, full_name="Verify Cancel Retry", hashed_password="x", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def main() -> int:
    from app.crud.meeting import create_meeting, get_meeting
    from app.crud.processing_job import get_processing_job_by_id
    from app.crud.upload import create_upload
    from app.db.session import SessionLocal
    from app.schemas.meeting import MeetingCreate
    from app.services.meeting_service import delete_meeting_cascade
    from app.services.processing_service import (
        cancel_processing_job,
        execute_processing_job,
        queue_processing_job,
        retry_processing_job,
    )
    from app.services.transcription import subprocess_runner
    from app.workers import processor

    problems: list[str] = []
    audio_bytes = _build_wav(_SOURCE_WAV, loops=6)  # ~5 min, plenty of time to cancel mid-transcription

    # --- A/B: cancellation ---
    db = SessionLocal()
    try:
        user = _get_or_create_test_user(db)
        meeting = create_meeting(
            db, user_id=user.id,
            meeting_in=MeetingCreate(title=f"cancel-verify-{uuid.uuid4().hex[:8]}", source_type="upload-recording"),
        )
        upload = create_upload(
            db, user_id=user.id, meeting_id=meeting.id, original_filename="cancel.wav",
            stored_filename=f"{uuid.uuid4()}.wav", storage_path=f"verify/{uuid.uuid4()}.wav",
            bucket="verify", mime_type="audio/wav", size_bytes=len(audio_bytes),
        )
        job = queue_processing_job(db, upload=upload, user=user)
        job_id, meeting_id, user_id = job.id, meeting.id, user.id
    finally:
        db.close()

    async def _run_and_cancel():
        with patch.object(processor, "download_file", return_value=audio_bytes):
            task = asyncio.create_task(execute_processing_job(job_id))
            # Give it time to get into the transcription child process, then cancel.
            await asyncio.sleep(8.0)
            cdb = SessionLocal()
            try:
                cjob = get_processing_job_by_id(cdb, job_id)
                stage_at_cancel = cjob.stage if cjob else None
                pid_at_cancel = subprocess_runner._active_processes.get(job_id)
                pid_at_cancel = pid_at_cancel.pid if pid_at_cancel is not None else None
                cancel_processing_job(cdb, cjob)
            finally:
                cdb.close()
            await task
            return stage_at_cancel, pid_at_cancel

    stage_at_cancel, pid_at_cancel = asyncio.run(_run_and_cancel())
    print(f"Cancelled while job stage='{stage_at_cancel}', transcription worker pid={pid_at_cancel}")

    db = SessionLocal()
    try:
        final_job = get_processing_job_by_id(db, job_id)
        if final_job is None or final_job.status != "cancelled":
            problems.append(f"expected job status 'cancelled', got {final_job.status if final_job else 'MISSING'}")
        else:
            print("OK: job status is 'cancelled'")

        meeting_after = get_meeting(db, meeting_id, user_id)
        if meeting_after is None or meeting_after.status != "failed":
            problems.append(
                f"expected meeting status 'failed' (cancel's documented mapping), got "
                f"{meeting_after.status if meeting_after else 'MISSING'}"
            )
        else:
            print("OK: meeting status is 'failed' (cancellation's documented terminal mapping)")
    finally:
        db.close()

    # No psutil in this env -- check process liveness via the tracking dict
    # `subprocess_runner` itself already maintains, not a new dependency.
    time.sleep(2.0)  # grace period for terminate()+join() to finish reaping
    with subprocess_runner._active_lock:
        still_tracked = job_id in subprocess_runner._active_processes
    if still_tracked:
        problems.append("transcription worker process is still tracked as active after cancellation")
    else:
        print("OK: no transcription worker process tracked for this job after cancellation (no orphan)")

    # --- C: retry ---
    db = SessionLocal()
    try:
        job_row = get_processing_job_by_id(db, job_id)
        job_row.status = "failed"  # cancelled jobs are retryable too, but exercise the more common path
        db.commit()
        retried = retry_processing_job(db, job_row)
        # `retry_processing_job` resets the JOB row to "queued" (per
        # `reset_job_for_retry`) -- it re-queues the work, it doesn't execute
        # it. The MEETING flips to "processing" immediately (checked below);
        # the job only reaches "processing" once a new `execute_processing_job`
        # background task actually picks it up (which the retry endpoint
        # triggers, but this script calls `retry_processing_job` directly).
        if retried.status != "queued":
            problems.append(f"expected retried job status 'queued', got {retried.status}")
        else:
            print("OK: retry_processing_job reset the job to 'queued'")
        meeting_after_retry = get_meeting(db, meeting_id, user_id)
        if meeting_after_retry is None or meeting_after_retry.status != "processing":
            problems.append("expected meeting status 'processing' after retry")
        else:
            print("OK: meeting status is 'processing' after retry")
    finally:
        db.close()

    # cleanup
    db = SessionLocal()
    try:
        meeting_final = get_meeting(db, meeting_id, user_id)
        if meeting_final is not None:
            with patch("app.services.meeting_service.delete_file", return_value=None):
                delete_meeting_cascade(db, meeting_final)
        print("Cleaned up.")
    finally:
        db.close()

    if problems:
        print("\nFAILED:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("\nALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
