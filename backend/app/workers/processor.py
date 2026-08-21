"""Real transcription pipeline steps: download -> extract audio -> load model -> transcribe.

Each step wraps a blocking call (network I/O, audio decoding, model inference)
in `asyncio.to_thread` so it doesn't block the event loop the rest of the API
runs on. Only depends on `app.services.transcription`'s provider-agnostic
interface, so switching `TRANSCRIPTION_PROVIDER` never touches this module.
"""

import asyncio
import logging

import numpy as np

from app.core.config import get_settings
from app.models.upload import Upload
from app.services.storage_service import download_file
from app.services.transcription.audio import extract_audio
from app.services.transcription.base import (
    TranscriptionProvider,
    TranscriptionResult,
    is_unusable_transcription,
)
from app.services.transcription.factory import get_transcription_provider

logger = logging.getLogger("converra")


async def download_upload(upload: Upload) -> bytes:
    """Downloads the source media file from storage."""
    return await asyncio.to_thread(download_file, upload.storage_path, bucket=upload.bucket)


async def extract_audio_track(file_bytes: bytes) -> tuple[np.ndarray, float]:
    """Decodes the audio track (from an audio or video file) into a waveform."""
    return await asyncio.to_thread(extract_audio, file_bytes)


async def load_provider() -> TranscriptionProvider:
    """Loads (or reuses, if already warm) the configured (default/base) transcription provider."""
    return await asyncio.to_thread(get_transcription_provider)


async def transcribe(provider: TranscriptionProvider, waveform: np.ndarray) -> TranscriptionResult:
    return await asyncio.to_thread(provider.transcribe, waveform)


async def transcribe_with_fallback(
    provider: TranscriptionProvider, waveform: np.ndarray
) -> tuple[TranscriptionResult, str, str | None]:
    """Transcribes with the already-loaded base provider, and — only if that
    produced unusable output (see `is_unusable_transcription`: empty, or
    garbage/hallucinated — dominated by a repeated character, mostly
    non-alphabetic, or failing Whisper's own confidence heuristics) —
    retries once with the configured `whisper_fallback_model_size` ("small"
    by default).

    A valid base result is never retried, and the fallback model is never
    used as the default; it's loaded lazily, on demand, only on this path.

    Returns `(result, model_used, fallback_reason)`. `fallback_reason` is
    `None` when the base pass was already usable.
    """
    settings = get_settings()
    base_size = settings.whisper_model_size

    result = await asyncio.to_thread(provider.transcribe, waveform)
    if not is_unusable_transcription(result):
        return result, base_size, None

    fallback_size = settings.whisper_fallback_model_size
    reason = (
        f"base model '{base_size}' produced unusable output "
        f"(segments={len(result.segments)}, word_count={result.word_count})"
    )
    logger.warning("Transcription fallback triggered: %s -> retrying with '%s'", reason, fallback_size)

    fallback_provider = await asyncio.to_thread(get_transcription_provider, fallback_size)
    fallback_result = await asyncio.to_thread(fallback_provider.transcribe, waveform)

    if is_unusable_transcription(fallback_result):
        logger.warning(
            "Fallback model '%s' also produced unusable output (segments=%d, word_count=%d)",
            fallback_size, len(fallback_result.segments), fallback_result.word_count,
        )

    return fallback_result, fallback_size, reason
