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
def _build_provider(provider_name: str, model_size: str) -> TranscriptionProvider:
    if provider_name == "faster_whisper":
        from app.services.transcription.faster_whisper import FasterWhisperProvider

        return FasterWhisperProvider(model_size=model_size)

    raise ValueError(f"Unknown transcription provider: '{provider_name}'")


def get_transcription_provider(model_size: str | None = None) -> TranscriptionProvider:
    """Returns a provider for `model_size` (default: the configured
    `whisper_model_size`, i.e. `base`), constructing (and caching) one
    instance per distinct model size. Caching matters because providers like
    faster-whisper load a model into memory on construction — a low-confidence
    fallback within the same job reuses the warm base-model instance's
    process instead of reloading from disk.

    In production this is only ever called from inside the dedicated
    transcription worker process started by
    `transcription.subprocess_runner.run_transcription_job` (one child
    process per job), so this cache's lifetime is scoped to that one child
    process and never accumulates across jobs — when the child exits, the
    cache (and the model weights it's holding) goes with it.
    """
    settings = get_settings()
    resolved_size = model_size or settings.whisper_model_size
    return _build_provider(settings.transcription_provider, resolved_size)
