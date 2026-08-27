"""Provider-agnostic contract for the speaker-diarization layer.

Diarization answers "who spoke when" as a separate concern from
transcription (`app.services.transcription`) -- it takes the same decoded
mono waveform (see `app.services.transcription.audio.extract_audio`) but
never touches Whisper's output, and nothing here reads or writes
`Transcript.segments`.

`speaker_key` uses the same `speaker_N` format `MeetingSpeaker.speaker_key`
reserves (`app.models.meeting_speaker`) as "the stable handle a future
diarization pass would key its output to" -- this is that pass, but wiring
its output into stored `MeetingSpeaker`/`Transcript` rows is a later step,
not this one.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass
class DiarizationSegment:
    """One stretch of time attributed to a single speaker.

    `speaker_key` (`speaker_1`, `speaker_2`, ...) is stable for the whole
    recording -- assigned once, globally, in order of each speaker's first
    appearance -- never a fresh label per chunk. It is an internal handle,
    never an inferred human name.
    """

    start: float
    end: float
    speaker_key: str


class DiarizationProvider(ABC):
    """A "who spoke when" backend. Instances may load models/build lookup
    tables in `__init__`, so callers should get one via
    `get_diarization_provider()` (cached) rather than constructing providers
    directly -- mirrors `TranscriptionProvider` in
    `app.services.transcription.base`.
    """

    @abstractmethod
    def diarize(self, audio: np.ndarray, *, sample_rate: int = 16000) -> list[DiarizationSegment]:
        """Returns time-ordered, non-overlapping `DiarizationSegment`s for a
        mono float32 waveform in the [-1, 1] range (same contract as
        `TranscriptionProvider.transcribe`)."""
        raise NotImplementedError
