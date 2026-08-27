"""Provider-agnostic contract for the transcription step of the processing pipeline.

Every provider (faster-whisper today; OpenAI/Deepgram/AssemblyAI later) takes a
decoded mono waveform and returns a `TranscriptionResult`. Nothing above this
layer (the worker, the processing service) depends on which provider is
selected — see `factory.get_transcription_provider`.
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass, field

import numpy as np


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str
    # The stable `MeetingSpeaker.speaker_key` diarization assigned this
    # segment (`app.services.speaker_alignment_service`), `None` when no
    # reliable diarization overlap was found. Defaults to `None` so every
    # existing construction site (providers that predate diarization, or
    # that never assign one) is unaffected.
    speaker_key: str | None = None


@dataclass
class TranscriptionResult:
    text: str
    language: str | None
    duration: float
    word_count: int
    segments: list[TranscriptSegment] = field(default_factory=list)
    # Aggregate (mean across segments) confidence signals from the provider,
    # when it exposes them — faster-whisper does. `None` when a provider
    # doesn't supply one; `is_unusable_transcription` treats a missing signal
    # as "not evidence of failure" rather than guessing.
    avg_logprob: float | None = None
    no_speech_prob: float | None = None
    compression_ratio: float | None = None


class TranscriptionProvider(ABC):
    """A speech-to-text backend. Instances may load heavyweight models in
    `__init__`, so callers should get one via `get_transcription_provider()`
    (cached) rather than constructing providers directly.
    """

    @abstractmethod
    def transcribe(self, audio: np.ndarray, *, sample_rate: int = 16000) -> TranscriptionResult:
        """Transcribes a mono float32 waveform in the [-1, 1] range."""
        raise NotImplementedError


# A single character (or short run) dominating the output — e.g. a page of
# "― ― ― ―" — is a classic Whisper hallucination pattern on silence/noise,
# not real speech in any language.
_MAX_DOMINANT_CHAR_RATIO = 0.4
# Genuine speech, in any script (Latin, Devanagari, Telugu, ...), is mostly
# letters. Output that's mostly punctuation/symbols/digits is not a transcript.
_MIN_ALPHA_RATIO = 0.3
# These three mirror OpenAI Whisper's own decode-time hallucination heuristic
# (see `whisper.transcribe`'s `compression_ratio_threshold` /
# `logprob_threshold` / `no_speech_threshold` defaults): highly compressible
# text is repetitive, a low average log-probability means the model itself
# had low confidence in the tokens it emitted, and a high no-speech
# probability paired with a low log-probability means it likely decoded
# non-speech audio instead of leaving it blank.
_MAX_AVG_COMPRESSION_RATIO = 2.4
_MIN_AVG_LOGPROB = -1.0
_MAX_AVG_NO_SPEECH_PROB = 0.6

_WHITESPACE_RE = re.compile(r"\s+")


def _dominant_char_ratio(text: str) -> float:
    stripped = _WHITESPACE_RE.sub("", text)
    if not stripped:
        return 0.0
    counts = Counter(stripped)
    return max(counts.values()) / len(stripped)


def _alpha_ratio(text: str) -> float:
    stripped = _WHITESPACE_RE.sub("", text)
    if not stripped:
        return 0.0
    return sum(1 for ch in stripped if ch.isalpha()) / len(stripped)


def _low_confidence_signal(
    avg_logprob: float | None,
    no_speech_prob: float | None,
    compression_ratio: float | None,
) -> bool:
    """Shared core of the compression-ratio / logprob / no-speech-prob check,
    usable both on a whole-result aggregate (`is_unusable_transcription`) and
    on a single segment (`is_unusable_segment`) -- same thresholds either way.
    """
    if compression_ratio is not None and compression_ratio > _MAX_AVG_COMPRESSION_RATIO:
        return True
    if (
        avg_logprob is not None
        and no_speech_prob is not None
        and avg_logprob < _MIN_AVG_LOGPROB
        and no_speech_prob > _MAX_AVG_NO_SPEECH_PROB
    ):
        return True
    return False


def is_unusable_segment(
    text: str,
    *,
    avg_logprob: float | None,
    no_speech_prob: float | None,
    compression_ratio: float | None,
) -> bool:
    """Single-segment counterpart of `is_unusable_transcription`, for callers
    (the live meeting worker) that need to drop individual hallucinated/
    background-noise segments from a stream rather than judge one aggregated
    result. Same heuristics, same thresholds -- see that function's docstring.
    """
    text = text.strip()
    if not text:
        return True
    if _dominant_char_ratio(text) > _MAX_DOMINANT_CHAR_RATIO:
        return True
    if _alpha_ratio(text) < _MIN_ALPHA_RATIO:
        return True
    return _low_confidence_signal(avg_logprob, no_speech_prob, compression_ratio)


def is_unusable_transcription(result: TranscriptionResult) -> bool:
    """True when a transcription result is unusable and should not be treated
    as a successful pass — either empty, or (non-empty but) garbage/hallucinated:

    - no segments, no words, or an empty/whitespace-only transcript
    - a single character/short run dominates the text (e.g. repeated dashes)
    - the text is mostly non-alphabetic (punctuation/symbol noise, no
      meaningful words in any language)
    - the provider's own confidence signals (compression ratio, average
      log-probability, no-speech probability — when it supplies them) match
      Whisper's own hallucination/silence heuristics

    A non-zero `word_count` alone is therefore not sufficient to pass: a
    transcript full of repeated dash characters can have a positive word
    count (whitespace-separated tokens) while being entirely unusable.

    These are the signals used to trigger the base->small fallback (and, if
    the fallback also fails one of these, to fail the job instead of
    completing with a garbage transcript).
    """
    if not result.segments or result.word_count == 0 or not result.text.strip():
        return True

    text = result.text.strip()
    if _dominant_char_ratio(text) > _MAX_DOMINANT_CHAR_RATIO:
        return True
    if _alpha_ratio(text) < _MIN_ALPHA_RATIO:
        return True
    return _low_confidence_signal(result.avg_logprob, result.no_speech_prob, result.compression_ratio)
