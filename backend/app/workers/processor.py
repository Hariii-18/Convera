"""Real transcription pipeline steps: download -> extract audio -> load model -> transcribe.

Each step wraps a blocking call (network I/O, audio decoding, model inference)
in `asyncio.to_thread` so it doesn't block the event loop the rest of the API
runs on. Only depends on `app.services.transcription`'s provider-agnostic
interface, so switching `TRANSCRIPTION_PROVIDER` never touches this module.
"""

import asyncio

import numpy as np

from app.models.upload import Upload
from app.services.storage_service import download_file
from app.services.transcription.audio import extract_audio
from app.services.transcription.base import TranscriptionProvider, TranscriptionResult
from app.services.transcription.factory import get_transcription_provider


async def download_upload(upload: Upload) -> bytes:
    """Downloads the source media file from storage."""
    return await asyncio.to_thread(download_file, upload.storage_path, bucket=upload.bucket)


async def extract_audio_track(file_bytes: bytes) -> tuple[np.ndarray, float]:
    """Decodes the audio track (from an audio or video file) into a waveform."""
    return await asyncio.to_thread(extract_audio, file_bytes)


async def load_provider() -> TranscriptionProvider:
    """Loads (or reuses, if already warm) the configured transcription provider."""
    return await asyncio.to_thread(get_transcription_provider)


async def transcribe(provider: TranscriptionProvider, waveform: np.ndarray) -> TranscriptionResult:
    return await asyncio.to_thread(provider.transcribe, waveform)
