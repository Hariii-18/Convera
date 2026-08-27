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
    def __init__(self, *, model_size: str | None = None) -> None:
        settings = get_settings()
        self.model_size = model_size or settings.whisper_model_size
        logger.info(
            "Loading faster-whisper model '%s' (device=%s, compute_type=%s)",
            self.model_size,
            settings.whisper_device,
            settings.whisper_compute_type,
        )
        self._model = WhisperModel(
            self.model_size,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
        logger.info("Loaded faster-whisper model '%s'", self.model_size)

    def transcribe(self, audio: np.ndarray, *, sample_rate: int = 16000) -> TranscriptionResult:
        # `multilingual=True` re-runs language detection on every ~30s chunk
        # instead of locking the whole recording to whatever language is
        # detected in the first window, so English -> Telugu -> Hindi
        # switches are decoded with the right tokenizer/language per chunk.
        # `condition_on_previous_text=False` stops the decoder from feeding
        # the previous chunk's (possibly wrong-language) tokens back in as
        # prompt context, which is what was driving the repeated/hallucinated
        # text right after a language switch.
        segments_iter, info = self._model.transcribe(
            audio,
            task="transcribe",
            beam_size=1,
            vad_filter=True,
            vad_parameters=dict(threshold=0.35),
            no_speech_threshold=0.4,
            multilingual=True,
            condition_on_previous_text=False,
        )

        segments: list[TranscriptSegment] = []
        text_parts: list[str] = []
        avg_logprobs: list[float] = []
        no_speech_probs: list[float] = []
        compression_ratios: list[float] = []
        for segment in segments_iter:
            text = segment.text.strip()
            if not text:
                continue
            segments.append(TranscriptSegment(start=segment.start, end=segment.end, text=text))
            text_parts.append(text)
            avg_logprobs.append(segment.avg_logprob)
            no_speech_probs.append(segment.no_speech_prob)
            compression_ratios.append(segment.compression_ratio)

        full_text = " ".join(text_parts).strip()

        return TranscriptionResult(
            text=full_text,
            language=info.language,
            duration=info.duration,
            word_count=len(full_text.split()) if full_text else 0,
            segments=segments,
            avg_logprob=sum(avg_logprobs) / len(avg_logprobs) if avg_logprobs else None,
            no_speech_prob=sum(no_speech_probs) / len(no_speech_probs) if no_speech_probs else None,
            compression_ratio=sum(compression_ratios) / len(compression_ratios) if compression_ratios else None,
        )
