"""Shared post-transcription processing pipeline.

Runs the downstream steps common to every transcript, regardless of how it
was produced (a recorded-upload transcript today; a finalized Live Meeting
transcript in a later phase):

    Final Transcript -> Normalize (optional) -> OpenAI Summary -> Completed

Normalization is an enhancement, not a prerequisite: if it fails, the
pipeline falls back to the raw transcript and still runs Summary, so a
transcript+summary can complete even when normalization never succeeds.

Translation is intentionally never triggered here — it stays a separate,
explicitly user-initiated action (`translation_service.generate_translated_transcript`,
`POST /transcripts/translate`).

The pipeline only takes a `meeting_id`: it has no dependency on `Upload` or
`ProcessingJob`, so it can be called as-is once a transcript has been
persisted, whatever finalized it. `on_stage`, if given, is called before each
step so a caller with its own progress tracking (e.g. `processing_service`'s
`ProcessingJob`-backed stages) can surface it — the pipeline itself doesn't
know that model exists.
"""

import logging
import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.summary import get_summary_by_meeting_id, set_timeline_events
from app.crud.transcript import get_transcript_by_meeting_id
from app.models.summary import Summary
from app.services.meeting_notes_service import ensure_meeting_notes
from app.services.normalization_service import generate_normalized_transcript
from app.services.summary_service import persist_summary_result, run_summary_ai
from app.services.timeline_service import build_timeline_events, generate_timeline_for_meeting

logger = logging.getLogger("converra")

StageReporter = Callable[[str, int], None]

_STAGE_FINALIZING = "Finalizing transcript"
_STAGE_NORMALIZING = "Normalizing transcript"
_STAGE_SUMMARIZING = "Generating summary"
_STAGE_TIMELINE = "Generating timeline"


def run_post_transcription_pipeline(
    db: Session,
    meeting_id: uuid.UUID,
    *,
    on_stage: StageReporter | None = None,
) -> Summary:
    """Runs the shared downstream pipeline for a meeting whose transcript has
    already been finalized and persisted. Producing that transcript is the
    caller's responsibility (Faster-Whisper for uploads today; live
    transcription finalization in a future phase) — this raises `AppError`
    if none exists yet rather than transcribing anything itself.

    Idempotent and resumable, so it's safe to call more than once for the
    same meeting:
    - A transcript that's already normalized (`normalized_at` set) is not
      re-normalized.
    - A meeting that already has a summary is not re-summarized.
    - A retry after a failed step resumes from that step; earlier steps'
      data is untouched.

    Raises `AppError` (never silently completes) if a required step fails,
    leaving all data persisted so far intact.
    """

    def report(stage: str, progress: int) -> None:
        if on_stage is not None:
            on_stage(stage, progress)

    report(_STAGE_FINALIZING, 90)
    transcript = get_transcript_by_meeting_id(db, meeting_id)
    if transcript is None:
        raise AppError(
            "Transcript not found: transcription must complete before the "
            "post-transcription pipeline can run.",
            status.HTTP_404_NOT_FOUND,
        )

    if transcript.normalized_at is None:
        report(_STAGE_NORMALIZING, 93)
        logger.info("Pipeline: normalizing transcript for meeting %s", meeting_id)
        t0 = time.perf_counter()
        try:
            generate_normalized_transcript(db, meeting_id)
            logger.info(
                "[timing] meeting %s normalize end elapsed=%.3fs", meeting_id, time.perf_counter() - t0
            )
        except AppError as exc:
            # Normalization is an optional enhancement, not a prerequisite for
            # a summary: the raw transcript is always a valid summary input
            # (see `summary_service.generate_summary`'s fallback), so a
            # normalization failure must never block Summary or fail the
            # whole pipeline. `normalized_at` is left unset, which is itself
            # the retry marker -- the next call to this function (a job/live
            # session retry, or simply re-running the pipeline) will attempt
            # normalization again rather than skipping it.
            logger.warning(
                "Pipeline: normalization failed for meeting %s, continuing to summary "
                "with the raw transcript (retryable): %s",
                meeting_id, exc.message,
            )
    else:
        logger.info("Pipeline: transcript for meeting %s already normalized, skipping", meeting_id)

    existing_summary = get_summary_by_meeting_id(db, meeting_id)
    if existing_summary is not None:
        logger.info("Pipeline: summary already exists for meeting %s, skipping", meeting_id)
        if not existing_summary.timeline_events:
            # Retryable the same way normalization is: an empty list is both
            # "never generated" and "last attempt found nothing", so a
            # meeting summarized before this feature existed (or whose
            # provider was unreachable last time) picks up a timeline on the
            # next pipeline run instead of staying empty forever.
            report(_STAGE_TIMELINE, 97)
            existing_summary = generate_timeline_for_meeting(db, meeting_id, existing_summary)
        # Still ensure Meeting Notes exists (e.g. a meeting summarized before
        # this table existed) - a no-op if it's already there, and it must
        # never re-derive over a user's saved edits either way. See
        # `ensure_meeting_notes`.
        ensure_meeting_notes(db, meeting_id)
        return existing_summary

    report(_STAGE_SUMMARIZING, 96)
    logger.info("Pipeline: generating summary and timeline for meeting %s", meeting_id)
    # Summary and Timeline are both independent AI-provider calls over the
    # same transcript (Timeline never reads the Summary's content), so their
    # two network round trips run concurrently here instead of one after the
    # other. Each side does its own AI call only in its thread -- no DB
    # access happens until both are back, since a SQLAlchemy `Session` isn't
    # safe to use from more than one thread at a time. `run_summary_ai`
    # raises `AppError` on failure (aborting the pipeline, same as before);
    # `build_timeline_events` never raises (returns `None` to mean "leave
    # timeline empty", same soft-fail contract Timeline has always had).
    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=2) as executor:
        summary_future = executor.submit(run_summary_ai, transcript)
        timeline_future = executor.submit(build_timeline_events, meeting_id, transcript)
        summary_result = summary_future.result()
        timeline_events = timeline_future.result()
    logger.info(
        "[timing] meeting %s summary+timeline(concurrent) elapsed=%.3fs",
        meeting_id, time.perf_counter() - t0,
    )

    t0 = time.perf_counter()
    summary = persist_summary_result(db, meeting_id=meeting_id, result=summary_result)
    logger.info("[timing] meeting %s summary end elapsed=%.3fs", meeting_id, time.perf_counter() - t0)

    report(_STAGE_TIMELINE, 98)
    if timeline_events is not None:
        t0 = time.perf_counter()
        summary = set_timeline_events(db, summary, timeline_events)
        logger.info("[timing] meeting %s timeline end elapsed=%.3fs", meeting_id, time.perf_counter() - t0)

    t0 = time.perf_counter()
    ensure_meeting_notes(db, meeting_id)
    logger.info("[timing] meeting %s meeting_notes end elapsed=%.3fs", meeting_id, time.perf_counter() - t0)
    return summary
