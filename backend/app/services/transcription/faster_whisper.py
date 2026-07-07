"""Local speech-to-text via faster-whisper (CTranslate2 Whisper implementation).

Runs entirely on-device — no external API calls — which is why this is the
default `TRANSCRIPTION_PROVIDER`.
"""

from __future__ import annotations

import logging

import numpy as np
from faster_whisper import WhisperModel

from app.core.config import get_settings
from app.services.transcription.base import (
    TranscriptionProvider,
    TranscriptionResult,
    TranscriptSegment,
)

logger = logging.getLogger("converra")


class FasterWhisperProvider(TranscriptionProvider):
    def __init__(self) -> None:
        settings = get_settings()
        logger.info(
            "Loading faster-whisper model '%s' (device=%s, compute_type=%s)",
            settings.whisper_model_size,
            settings.whisper_device,
            settings.whisper_compute_type,
        )
        self._model = WhisperModel(
            settings.whisper_model_size,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )

    def transcribe(self, audio: np.ndarray, *, sample_rate: int = 16000) -> TranscriptionResult:
        segments_iter, info = self._model.transcribe(audio, beam_size=5)

        segments: list[TranscriptSegment] = []
        text_parts: list[str] = []
        for segment in segments_iter:
            text = segment.text.strip()
            if not text:
                continue
            segments.append(TranscriptSegment(start=segment.start, end=segment.end, text=text))
            text_parts.append(text)

        full_text = " ".join(text_parts).strip()

        return TranscriptionResult(
            text=full_text,
            language=info.language,
            duration=info.duration,
            word_count=len(full_text.split()) if full_text else 0,
            segments=segments,
        )
