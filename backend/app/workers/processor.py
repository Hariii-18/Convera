"""Real transcription pipeline steps: download -> extract audio -> transcribe.

Each step wraps a blocking call (network I/O, audio decoding, model
inference) in `asyncio.to_thread` so it doesn't block the event loop the
rest of the API runs on. Transcription itself (model load, base pass, and
the small-model fallback if needed) runs in a dedicated child process --
see `transcription.subprocess_runner` -- that this module starts and tears
down per job, so the CTranslate2 model it loads is never resident in this
process once the phase is done. Only depends on `app.services.transcription`'s
provider-agnostic interface, so switching `TRANSCRIPTION_PROVIDER` never
touches this module.
"""

import asyncio
import logging
import uuid

import numpy as np

from app.models.upload import Upload
from app.services.storage_service import download_file
from app.services.transcription.audio import extract_audio
from app.services.transcription.base import TranscriptionResult
from app.services.transcription.subprocess_runner import (
    run_transcription_job,
    terminate_active_processes,
    terminate_job_process,
)

logger = logging.getLogger("converra")


async def download_upload(upload: Upload) -> bytes:
    """Downloads the source media file from storage."""
    return await asyncio.to_thread(download_file, upload.storage_path, bucket=upload.bucket)


async def extract_audio_track(file_bytes: bytes) -> tuple[np.ndarray, float]:
    """Decodes the audio track (from an audio or video file) into a waveform."""
    return await asyncio.to_thread(extract_audio, file_bytes)


async def transcribe_with_fallback(
    waveform: np.ndarray, job_id: uuid.UUID
) -> tuple[TranscriptionResult, str, str | None]:
    """Transcribes with the configured base model, and -- only if that
    produced unusable output (see `is_unusable_transcription`: empty, or
    garbage/hallucinated -- dominated by a repeated character, mostly
    non-alphabetic, or failing Whisper's own confidence heuristics) --
    retries once with the configured `whisper_fallback_model_size` ("small"
    by default).

    Both attempts run inside one dedicated child process (see
    `subprocess_runner.run_transcription_job`), registered under `job_id` so
    `cancel_transcription_job` can kill it if the job is cancelled while this
    is running. The process is terminated before this call returns --
    success, fallback, failure, or cancellation -- so the model(s) it loaded
    never linger in this (FastAPI) process.

    Returns `(result, model_used, fallback_reason)`. `fallback_reason` is
    `None` when the base pass was already usable.
    """
    return await asyncio.to_thread(run_transcription_job, waveform, job_id=job_id)


def cancel_transcription_job(job_id: uuid.UUID) -> bool:
    """Immediately kills the transcription worker process for `job_id`, if
    one is currently running. Used by job cancellation: transcription can
    block for up to an hour with no interruption points inside it (see
    `subprocess_runner`), so this is the only way a cancel during that phase
    takes effect promptly instead of at the next checkpoint. Returns `False`
    (no-op) if this job has no worker running, e.g. it was still queued or
    preparing.
    """
    return terminate_job_process(job_id)


async def release_transcription_resources() -> None:
    """Defensive cleanup stage: `transcribe_with_fallback` already
    terminates its own child process before returning, so under normal
    operation this finds nothing to do. Kept as an explicit pipeline step
    so every job -- including a retry that resumes from an existing
    transcript and never calls `transcribe_with_fallback` at all -- confirms
    no transcription worker process is attached to this one before summary
    generation starts.
    """
    await asyncio.to_thread(terminate_active_processes)
