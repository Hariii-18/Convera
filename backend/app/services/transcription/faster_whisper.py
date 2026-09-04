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
        model_kwargs = dict(device=settings.whisper_device, compute_type=settings.whisper_compute_type)
        try:
            # This provider is documented (see module docstring) as running
            # entirely on-device with no external API calls, but without
            # `local_files_only`, `WhisperModel` still makes a Hugging Face
            # Hub API request on *every* load to check for a newer model
            # revision before falling back to the local cache (visible as a
            # `GET huggingface.co/api/models/.../revision/main` in the logs
            # on every job). Once the weights are cached locally -- the
            # steady-state case in any long-running deployment -- that round
            # trip is pure per-job latency (and a needless network
            # dependency for an explicitly local provider) with no freshness
            # benefit. Falls back below to a normal (network-allowed) load
            # for the one case this would otherwise break: the very first
            # run after `whisper_model_size`/`whisper_fallback_model_size`
            # is set to a model that has never been downloaded yet.
            self._model = WhisperModel(self.model_size, local_files_only=True, **model_kwargs)
        except Exception:
            logger.info(
                "faster-whisper model '%s' not found in local cache; downloading", self.model_size
            )
            self._model = WhisperModel(self.model_size, **model_kwargs)
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
            segments.append(
                TranscriptSegment(
                    start=segment.start,
                    end=segment.end,
                    text=text,
                    avg_logprob=segment.avg_logprob,
                    no_speech_prob=segment.no_speech_prob,
                    compression_ratio=segment.compression_ratio,
                )
            )
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
