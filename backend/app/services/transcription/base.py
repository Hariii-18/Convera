"""Provider-agnostic contract for the transcription step of the processing pipeline.

Every provider (faster-whisper today; OpenAI/Deepgram/AssemblyAI later) takes a
decoded mono waveform and returns a `TranscriptionResult`. Nothing above this
layer (the worker, the processing service) depends on which provider is
selected — see `factory.get_transcription_provider`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import numpy as np


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str


@dataclass
class TranscriptionResult:
    text: str
    language: str | None
    duration: float
    word_count: int
    segments: list[TranscriptSegment] = field(default_factory=list)


class TranscriptionProvider(ABC):
    """A speech-to-text backend. Instances may load heavyweight models in
    `__init__`, so callers should get one via `get_transcription_provider()`
    (cached) rather than constructing providers directly.
    """

    @abstractmethod
    def transcribe(self, audio: np.ndarray, *, sample_rate: int = 16000) -> TranscriptionResult:
        """Transcribes a mono float32 waveform in the [-1, 1] range."""
        raise NotImplementedError
