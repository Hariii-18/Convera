import logging
import time
import uuid
from collections.abc import Callable
from dataclasses import asdict

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.meeting import get_meeting, update_meeting_status
from app.crud.notification import create_notification
from app.crud.processing_job import (
    create_processing_job,
    get_active_processing_job_for_upload,
    get_processing_job_by_id,
    mark_job_cancelled,
    mark_job_completed,
    mark_job_failed,
    mark_job_started,
    reset_job_for_retry,
    update_job_progress,
)
from app.crud.transcript import get_transcript_by_meeting_id, upsert_transcript
from app.crud.upload import get_upload
from app.db.session import SessionLocal
from app.models.processing_job import ACTIVE_STATUSES, ProcessingJob
from app.models.upload import Upload
from app.models.user import User
from app.schemas.meeting import MeetingUpdate
from app.services.diarization.factory import get_diarization_provider
from app.services.pipeline_service import run_post_transcription_pipeline
from app.services.speaker_alignment_service import (
    align_transcript_segments,
    sync_meeting_speakers_from_keys,
)
from app.services.transcription.base import is_unusable_transcription
from app.workers.processor import (
    cancel_transcription_job,
    download_upload,
    extract_audio_track,
    release_transcription_resources,
    transcribe_with_fallback,
)

logger = logging.getLogger("converra")


def _sync_meeting_status(
    db: Session, meeting_id: uuid.UUID, user_id: int, meeting_status: str, *, commit: bool = True
) -> None:
    meeting = get_meeting(db, meeting_id, user_id)
    if meeting is not None:
        update_meeting_status(db, meeting, meeting_status, commit=commit)


_NOTIFICATION_COPY: dict[str, tuple[str, str]] = {
    "completed": ("processing_completed", "Processing completed"),
    "failed": ("processing_failed", "Processing failed"),
    "cancelled": ("processing_cancelled", "Processing cancelled"),
}


def _notify_processing_outcome(
    db: Session, job: ProcessingJob, outcome: str, *, commit: bool = True
) -> None:
    """Creates the in-app notification for a job's terminal outcome
    (completed/failed/cancelled), owned by the job's user. Best-effort: a
    missing meeting (already hard-deleted, in principle) just falls back to
    a generic label rather than blocking the job's own status transition.
    """
    notif_type, title = _NOTIFICATION_COPY[outcome]
    meeting = get_meeting(db, job.meeting_id, job.user_id)
    meeting_title = meeting.title if meeting is not None else "Your meeting"

    if outcome == "completed":
        message = f'"{meeting_title}" finished processing and is ready to view.'
    elif outcome == "failed":
        message = f'"{meeting_title}" failed to process.'
    else:
        message = f'"{meeting_title}" processing was cancelled.'

    create_notification(
        db,
        user_id=job.user_id,
        type=notif_type,
        title=title,
        message=message,
        meeting_id=job.meeting_id,
        processing_job_id=job.id,
        commit=commit,
    )


def _finalize_job(
    db: Session,
    job: ProcessingJob,
    *,
    job_status: str,
    meeting_status: str,
    error_message: str | None = None,
) -> None:
    """Marks a job completed/failed and syncs its meeting's status in a
    single commit, so a crash between the two can never leave the job row
    showing one outcome while the meeting status is stuck on another.

    No-ops if the job has already been cancelled: cancellation kills the
    in-flight worker (see `cancel_processing_job`), which surfaces here as
    an ordinary completion/failure a moment later -- without this check that
    race would overwrite the "cancelled" status/stage with "failed" right
    after the user cancelled it.
    """
    if job.status == "cancelled":
        return
    if job_status == "completed":
        mark_job_completed(db, job, commit=False)
    else:
        mark_job_failed(db, job, error_message=error_message or "", commit=False)
    _sync_meeting_status(db, job.meeting_id, job.user_id, meeting_status, commit=False)
    _notify_processing_outcome(db, job, job_status, commit=False)
    db.commit()
    db.refresh(job)


class _JobCancelled(Exception):
    """Raised from a pipeline stage-reporter when the job was cancelled
    mid-run (row deleted, or status flipped to "cancelled"), so
    `execute_processing_job` can stop without treating the run as a failure.
    """


def _reload_active_job(db: Session, job_id: uuid.UUID) -> ProcessingJob | None:
    """Re-fetches the job and returns it only if the run should continue.

    Returns `None` both when the row is gone and when its status has been
    set to "cancelled" -- the same signal `execute_processing_job` already
    treats as "stop where you are" at every checkpoint between pipeline
    steps, which is how a queued/preparing job's cancellation takes effect
    (it simply never reaches the next step) and how a processing job's
    cancellation is confirmed after its worker process has been killed.

    Expires this session's identity map first: `cancel_processing_job` runs
    on a *different* `Session` (a request-scoped one; this function's caller
    holds one long-lived session for the whole job). SQLAlchemy's identity
    map does not refresh an already-loaded object's attributes from a new
    query by default, so without this, a `job` object this session loaded
    earlier (e.g. at `mark_job_started`) would keep reporting its status as
    of that load — silently missing a cancellation committed by the other
    session in between — until *this* session happens to commit something
    of its own. Cheap: it only marks attributes for reload on next access,
    it doesn't issue any queries by itself.
    """
    db.expire_all()
    job = get_processing_job_by_id(db, job_id)
    if job is None or job.status == "cancelled":
        return None
    return job


def _pipeline_stage_reporter(db: Session, job_id: uuid.UUID) -> Callable[[str, int], None]:
    """Bridges the upload-agnostic pipeline's `on_stage` callback to this
    job's `ProcessingJob` row, re-fetching it before every update so a
    cancellation stops the pipeline the same way every other step in this
    file already does.
    """

    def _on_stage(stage: str, progress: int) -> None:
        job = _reload_active_job(db, job_id)
        if job is None:
            raise _JobCancelled()
        update_job_progress(db, job, status="processing", stage=stage, progress=progress)

    return _on_stage


def queue_processing_job(db: Session, *, upload: Upload, user: User) -> ProcessingJob:
    """Creates a ProcessingJob for an upload and flips its meeting into "processing".

    Shared by the automatic upload-completion flow and the manual `POST /process`
    endpoint so both go through identical validation and side effects.

    Idempotent per upload: if an active job (queued/preparing/processing)
    already exists for this upload, that job is returned instead of creating
    a duplicate - covering repeated requests, double-clicks, and retried
    client calls. Concurrent callers are protected by a `FOR UPDATE` lock on
    any existing active row plus a partial unique index on
    `processing_jobs(upload_id)` (active statuses only) that makes the
    database itself reject a second concurrent insert; that race is caught
    below and resolved by returning the winner's job. Completed/failed jobs
    are historical and never block a new one, so reprocessing an upload after
    a prior run finished still works.
    """
    if upload.meeting_id is None:
        raise AppError("Upload is not linked to a meeting", status.HTTP_400_BAD_REQUEST)

    if get_meeting(db, upload.meeting_id, user.id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    existing_job = get_active_processing_job_for_upload(db, upload.id)
    if existing_job is not None:
        return existing_job

    try:
        job = create_processing_job(
            db, upload_id=upload.id, meeting_id=upload.meeting_id, user_id=user.id
        )
    except IntegrityError:
        db.rollback()
        existing_job = get_active_processing_job_for_upload(db, upload.id)
        if existing_job is None:
            raise
        return existing_job

    _sync_meeting_status(db, upload.meeting_id, user.id, "processing")
    return job


def retry_processing_job(db: Session, job: ProcessingJob) -> ProcessingJob:
    if job.status not in ("failed", "cancelled"):
        raise AppError(
            "Only failed or cancelled jobs can be retried", status.HTTP_400_BAD_REQUEST
        )

    job = reset_job_for_retry(db, job)
    _sync_meeting_status(db, job.meeting_id, job.user_id, "processing")
    return job


def cancel_processing_job(db: Session, job: ProcessingJob) -> ProcessingJob:
    """Cancels a queued/preparing/processing job in place.

    Never deletes the row -- the job's history (attempts, timestamps) stays
    intact for the UI and for `retry_processing_job`, which can resume a
    cancelled job exactly like a failed one. Flips the job straight to the
    terminal "cancelled" status and, if a transcription worker process is
    currently running for it, kills that process immediately rather than
    waiting for it to notice at its next checkpoint: transcription has no
    interruption points of its own (see `subprocess_runner`) and can
    otherwise keep running for up to an hour after the job row already says
    "cancelled". A queued or preparing job has no worker yet, so cancelling
    it is just the status flip -- `execute_processing_job` (or its
    not-yet-run `BackgroundTasks` invocation) sees "cancelled" at its very
    first checkpoint and never starts real work.

    Meeting.status is synced to "failed" (the existing terminal-but-
    retryable state a processing meeting already flips to on any job
    failure) rather than a new meeting-level status, since retrying a
    cancelled job flips it back to "processing" through the same edge a
    failed job's retry already uses.
    """
    if job.status not in ACTIVE_STATUSES:
        raise AppError(
            "Only queued, preparing, or processing jobs can be cancelled",
            status.HTTP_400_BAD_REQUEST,
        )

    had_worker = job.status in ("preparing", "processing")
    job = mark_job_cancelled(db, job)
    _sync_meeting_status(db, job.meeting_id, job.user_id, "failed")
    _notify_processing_outcome(db, job, "cancelled")
    if had_worker:
        cancel_transcription_job(job.id)
    return job


async def execute_processing_job(job_id: uuid.UUID) -> None:
    """Runs one ProcessingJob through the real transcription pipeline:

        Preparing -> Extract Audio -> Load Model -> Transcribing
        -> Saving Transcript -> Completed/Failed

    Invoked via FastAPI `BackgroundTasks` after the response has already been
    sent, so it opens its own DB session rather than reusing the request's.
    Re-fetches the job before each state transition (see `_reload_active_job`)
    so a cancelled job -- deleted row, or status flipped to "cancelled" --
    simply stops instead of erroring. A job cancelled while still "queued"
    is caught right here, before anything is marked "preparing" or any real
    work starts.
    """
    db = SessionLocal()
    try:
        job = _reload_active_job(db, job_id)
        if job is None:
            return

        upload = get_upload(db, job.upload_id, job.user_id)
        if upload is None:
            raise AppError("Upload not found", status.HTTP_404_NOT_FOUND)

        worker_name = f"whisper-worker-{job.id.hex[:8]}"
        job = mark_job_started(db, job, worker_name=worker_name)

        # A transcript already existing for this meeting only means THIS job
        # can skip re-transcribing when that transcript was produced by this
        # very job (`produced_by_job_id` matches) — i.e. a retry of a job
        # that got all the way through transcription and only failed later
        # (summary generation), which should resume from the summary step
        # rather than re-run Faster-Whisper. A brand-new ProcessingJob for an
        # already-processed meeting (reprocessing) has a different job id, so
        # it always re-transcribes and `upsert_transcript` replaces the
        # stale transcript (and, atomically, the stale summary).
        existing_transcript = get_transcript_by_meeting_id(db, job.meeting_id)
        if existing_transcript is None or existing_transcript.produced_by_job_id != job.id:
            logger.info("[timing] job %s download_upload start", job_id)
            t0 = time.perf_counter()
            file_bytes = await download_upload(upload)
            logger.info(
                "[timing] job %s download_upload end elapsed=%.3fs bytes=%d",
                job_id, time.perf_counter() - t0, len(file_bytes),
            )

            job = _reload_active_job(db, job_id)
            if job is None:
                return
            job = update_job_progress(db, job, status="processing", stage="Extracting audio", progress=20)

            logger.info("[timing] job %s extract_audio start", job_id)
            t0 = time.perf_counter()
            waveform, _duration_seconds = await extract_audio_track(file_bytes)
            logger.info(
                "[timing] job %s extract_audio end elapsed=%.3fs samples=%d duration=%.3fs",
                job_id, time.perf_counter() - t0, waveform.shape[0], _duration_seconds,
            )

            job = _reload_active_job(db, job_id)
            if job is None:
                return
            job = update_job_progress(db, job, status="processing", stage="Loading model", progress=35)

            job = _reload_active_job(db, job_id)
            if job is None:
                return
            job = update_job_progress(db, job, status="processing", stage="Transcribing", progress=45)

            # Model loading now happens inside the dedicated transcription
            # worker process spawned by `transcribe_with_fallback` itself
            # (see `subprocess_runner.run_transcription_job`), so it's timed
            # as part of this single "transcription" span rather than a
            # separate step. That process is registered under `job.id` for
            # the duration of the call, so a cancellation arriving while this
            # is in flight kills it directly (see `cancel_processing_job`)
            # instead of waiting for this checkpoint pattern to catch it --
            # this phase has no checkpoints of its own.
            logger.info("[timing] job %s transcription start", job_id)
            t0 = time.perf_counter()
            result, model_used, fallback_reason = await transcribe_with_fallback(waveform, job.id)
            logger.info(
                "[timing] job %s transcription end elapsed=%.3fs model=%s fallback_reason=%s",
                job_id, time.perf_counter() - t0, model_used, fallback_reason,
            )
            if fallback_reason is None:
                logger.info("Processing job %s transcribed with base model '%s'", job_id, model_used)
            else:
                logger.info(
                    "Processing job %s transcribed with fallback model '%s' (reason: %s)",
                    job_id, model_used, fallback_reason,
                )

            if is_unusable_transcription(result):
                # Base failed, fallback also failed (or the fallback model itself
                # produced no usable output) — don't complete with an empty
                # transcript, surface it as a failed/low-confidence job instead.
                error_message = (
                    f"Transcription produced no usable output with '{model_used}' "
                    f"({'after fallback from base' if fallback_reason else 'no fallback attempted'}): "
                    "no speech detected, or the audio could not be transcribed with confidence "
                    "(empty, garbage, or hallucinated output)."
                )
                logger.warning("Processing job %s low-confidence: %s", job_id, error_message)
                job = _reload_active_job(db, job_id)
                if job is not None:
                    _finalize_job(
                        db, job, job_status="failed", meeting_status="failed",
                        error_message=error_message,
                    )
                return

            job = _reload_active_job(db, job_id)
            if job is None:
                return
            job = update_job_progress(db, job, status="processing", stage="Saving transcript", progress=90)

            logger.info("[timing] job %s diarization start", job_id)
            t0 = time.perf_counter()
            try:
                diarization_segments = get_diarization_provider().diarize(waveform)
            except Exception:  # noqa: BLE001 (diarization is an enhancement, must never fail the job)
                logger.exception(
                    "Processing job %s: diarization failed, transcript will save with no speaker_key",
                    job_id,
                )
                diarization_segments = []
            logger.info(
                "[timing] job %s diarization end elapsed=%.3fs segments=%d",
                job_id, time.perf_counter() - t0, len(diarization_segments),
            )

            segments_with_speakers = align_transcript_segments(result.segments, diarization_segments)
            speaker_keys = {
                segment["speaker_key"] for segment in segments_with_speakers if segment["speaker_key"]
            }

            logger.info("[timing] job %s save_transcript start", job_id)
            t0 = time.perf_counter()
            upsert_transcript(
                db,
                meeting_id=job.meeting_id,
                upload_id=job.upload_id,
                language=result.language,
                transcript=result.text,
                segments=segments_with_speakers,
                duration=result.duration,
                word_count=result.word_count,
                produced_by_job_id=job.id,
            )
            sync_meeting_speakers_from_keys(db, job.meeting_id, speaker_keys)
            logger.info("[timing] job %s save_transcript end elapsed=%.3fs", job_id, time.perf_counter() - t0)
        else:
            logger.info(
                "Processing job %s: transcript already saved for meeting %s, resuming at summary generation",
                job_id, job.meeting_id,
            )

        logger.info("[timing] job %s release_transcription_resources start", job_id)
        t0 = time.perf_counter()
        await release_transcription_resources()
        logger.info(
            "[timing] job %s release_transcription_resources end elapsed=%.3fs",
            job_id, time.perf_counter() - t0,
        )

        job = _reload_active_job(db, job_id)
        if job is None:
            return

        # Everything downstream of a finalized transcript — normalize, then
        # summarize — lives in the shared pipeline so this same logic runs
        # for both a recorded upload (here) and, in a later phase, a
        # finalized Live Meeting transcript. It's resumable on its own: a
        # meeting that already has a normalized transcript and/or a summary
        # skips straight past those steps, so a retry never re-normalizes or
        # re-summarizes work that already succeeded.
        logger.info("Processing job %s: starting post-transcription pipeline", job_id)
        t0 = time.perf_counter()
        try:
            run_post_transcription_pipeline(
                db, job.meeting_id, on_stage=_pipeline_stage_reporter(db, job_id)
            )
        except _JobCancelled:
            return
        except AppError as exc:
            # The transcript (and normalized transcript, if that step had
            # already succeeded) is left untouched — only the failed step is
            # marked failed, and a retry of this job resumes from it without
            # re-transcribing or redoing earlier pipeline steps.
            logger.warning(
                "Processing job %s post-transcription pipeline failed (prior steps preserved): %s",
                job_id, exc.message,
            )
            job = _reload_active_job(db, job_id)
            if job is not None:
                _finalize_job(
                    db, job, job_status="failed", meeting_status="failed",
                    error_message=exc.message,
                )
            return
        logger.info("[timing] job %s pipeline end elapsed=%.3fs", job_id, time.perf_counter() - t0)

        job = _reload_active_job(db, job_id)
        if job is None:
            return

        logger.info("[timing] job %s finalization start", job_id)
        t0 = time.perf_counter()
        _finalize_job(db, job, job_status="completed", meeting_status="completed")
        logger.info("[timing] job %s finalization end elapsed=%.3fs", job_id, time.perf_counter() - t0)
        logger.info("Processing job %s completed for upload %s", job.id, upload.id)
    except Exception as exc:  # noqa: BLE001 (worker failure must never crash the task loop)
        # `db.expire_all()` before this lookup for the same reason as
        # `_reload_active_job`: cancellation almost always reaches this
        # handler *because* `cancel_processing_job` (on its own, different
        # `Session`) just killed the transcription worker process this job
        # was awaiting, breaking its pipe -- which races the identity-mapped
        # `job` this session loaded earlier against that other session's
        # just-committed "cancelled" status. Without expiring first, this
        # would misclassify a cancellation as a failure (wrong terminal
        # status, wrong user-facing notification) whenever it lands here
        # before this session's own next unrelated commit.
        db.expire_all()
        job = get_processing_job_by_id(db, job_id)
        if job is not None and job.status == "cancelled":
            # Killing the transcription worker process (`cancel_processing_job`)
            # surfaces here as this job's `await transcribe_with_fallback(...)`
            # raising once the pipe breaks -- expected, not a real failure.
            # `_finalize_job` would no-op anyway, but skip it (and the noisy
            # exception log) entirely since the job is already in its correct
            # terminal state.
            logger.info("Processing job %s stopped after cancellation", job_id)
        else:
            logger.exception("Processing job %s failed", job_id, exc_info=exc)
            if job is not None:
                _finalize_job(
                    db, job, job_status="failed", meeting_status="failed", error_message=str(exc)
                )
    finally:
        db.close()
