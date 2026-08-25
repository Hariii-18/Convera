"""Selects a `DiarizationProvider` implementation, mirroring
`app.services.transcription.factory.get_transcription_provider`.

Today there's one provider (`mfcc_diarizer.MfccDiarizationProvider`) -- see
its module docstring for why a CPU/no-torch approach was chosen for this
environment. A neural-embedding provider (pyannote.audio, wespeaker) can be
added the same way `TranscriptionProvider` gained providers: a sibling
module implementing `DiarizationProvider`, plus one branch here. Nothing
above this layer needs to change.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.services.diarization.base import DiarizationProvider


@lru_cache
def _build_provider(provider_name: str) -> DiarizationProvider:
    if provider_name == "mfcc":
        from app.services.diarization.mfcc_diarizer import MfccDiarizationProvider

        return MfccDiarizationProvider()

    raise ValueError(f"Unknown diarization provider: '{provider_name}'")


def get_diarization_provider() -> DiarizationProvider:
    settings = get_settings()
    return _build_provider(settings.diarization_provider)
