"""Selects a `TranscriptionProvider` implementation based on `TRANSCRIPTION_PROVIDER`.

To add a new provider (OpenAI, Deepgram, AssemblyAI, ...): implement
`TranscriptionProvider` in a sibling module and add one branch here. Nothing
else in the processing pipeline needs to change.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.services.transcription.base import TranscriptionProvider


@lru_cache
def get_transcription_provider() -> TranscriptionProvider:
    """Returns the configured provider, constructing (and caching) it once per
    process. Caching matters because providers like faster-whisper load a
    model into memory on construction — later jobs reuse the warm instance.
    """
    provider_name = get_settings().transcription_provider

    if provider_name == "faster_whisper":
        from app.services.transcription.faster_whisper import FasterWhisperProvider

        return FasterWhisperProvider()

    raise ValueError(f"Unknown transcription provider: '{provider_name}'")
