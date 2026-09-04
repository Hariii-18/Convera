"""One-off controlled experiment (not part of the benchmark/regression suite):
does forcing `language="en"` (or another minimal config change) improve
real-world English meeting transcription on `base`, without regressing
coverage or introducing hallucination?

Uses the exact same audio the model-size benchmark
(`benchmark_whisper_models.py`) just used: the only real speech fixture in
the repo (`.audit/test_meeting_multispeaker.wav`, ~50s real multi-speaker
English speech) looped via `benchmark_processing_pipeline._build_benchmark_wav`
to the same ~400s target duration, decoded via the real `extract_audio`.

Loads the `base` model exactly once (`whisper_model_size` is never touched)
and calls `WhisperModel.transcribe` directly per configuration so only the
transcribe-time kwargs vary between A/B/C -- everything else (model, device,
compute_type, decoded waveform) is held fixed.

Usage:
  python -m scripts.experiment_whisper_language_robustness
  python -m scripts.experiment_whisper_language_robustness --seconds 400
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_SOURCE_WAV = _REPO_ROOT / ".audit" / "test_meeting_multispeaker.wav"

sys.path.insert(0, str(_BACKEND_ROOT))


@dataclass
class ConfigResult:
    name: str
    kwargs_desc: str
    transcribe_seconds: float
    rtf: float
    language: str | None
    language_probability: float | None
    segment_count: int
    word_count: int
    covered_seconds: float
    coverage_pct: float
    avg_logprob: float | None
    no_speech_prob: float | None
    compression_ratio: float | None
    is_unusable: bool
    max_repeat_run: int
    repeated_ngram_hits: int
    tail_segments_preview: str
    text_preview: str


def _covered_seconds(segments: list) -> float:
    return sum(max(0.0, s.end - s.start) for s in segments)


def _max_consecutive_repeat(text_parts: list[str]) -> int:
    """Longest run of consecutive identical segment texts -- a repeated-text
    hallucination signature (the decoder gets stuck echoing one phrase)."""
    best = run = 1
    for i in range(1, len(text_parts)):
        if text_parts[i] == text_parts[i - 1]:
            run += 1
            best = max(best, run)
        else:
            run = 1
    return best if text_parts else 0


def _repeated_ngram_hits(full_text: str, n: int = 5) -> int:
    """Count of 5-word n-grams that occur 3+ times in the transcript -- a
    looping/hallucination signature distinct from exact-segment repeats."""
    words = full_text.split()
    if len(words) < n:
        return 0
    grams = Counter(tuple(words[i : i + n]) for i in range(len(words) - n + 1))
    return sum(1 for count in grams.values() if count >= 3)


def _run_config(model, name: str, kwargs_desc: str, audio, **transcribe_kwargs) -> ConfigResult:
    from app.services.transcription.base import (
        TranscriptSegment,
        is_unusable_transcription,
    )
    from app.services.transcription.base import TranscriptionResult as _TR

    t0 = time.perf_counter()
    segments_iter, info = model.transcribe(audio, task="transcribe", **transcribe_kwargs)

    segments: list[TranscriptSegment] = []
    text_parts: list[str] = []
    avg_logprobs, no_speech_probs, compression_ratios = [], [], []
    for segment in segments_iter:
        text = segment.text.strip()
        if not text:
            continue
        segments.append(TranscriptSegment(start=segment.start, end=segment.end, text=text))
        text_parts.append(text)
        avg_logprobs.append(segment.avg_logprob)
        no_speech_probs.append(segment.no_speech_prob)
        compression_ratios.append(segment.compression_ratio)
    transcribe_seconds = time.perf_counter() - t0

    full_text = " ".join(text_parts).strip()
    result = _TR(
        text=full_text,
        language=info.language,
        duration=info.duration,
        word_count=len(full_text.split()) if full_text else 0,
        segments=segments,
        avg_logprob=sum(avg_logprobs) / len(avg_logprobs) if avg_logprobs else None,
        no_speech_prob=sum(no_speech_probs) / len(no_speech_probs) if no_speech_probs else None,
        compression_ratio=sum(compression_ratios) / len(compression_ratios) if compression_ratios else None,
    )

    covered = _covered_seconds(segments)
    tail = segments[-3:] if segments else []
    tail_preview = " | ".join(f"[{s.start:.0f}-{s.end:.0f}] {s.text}" for s in tail)

    return ConfigResult(
        name=name,
        kwargs_desc=kwargs_desc,
        transcribe_seconds=transcribe_seconds,
        rtf=transcribe_seconds / info.duration if info.duration else float("nan"),
        language=info.language,
        language_probability=getattr(info, "language_probability", None),
        segment_count=len(segments),
        word_count=result.word_count,
        covered_seconds=covered,
        coverage_pct=(covered / info.duration * 100) if info.duration else 0.0,
        avg_logprob=result.avg_logprob,
        no_speech_prob=result.no_speech_prob,
        compression_ratio=result.compression_ratio,
        is_unusable=is_unusable_transcription(result),
        max_repeat_run=_max_consecutive_repeat(text_parts),
        repeated_ngram_hits=_repeated_ngram_hits(full_text),
        tail_segments_preview=tail_preview,
        text_preview=full_text[:300],
    )


def _print_result(r: ConfigResult) -> None:
    print(f"\n--- {r.name} ({r.kwargs_desc}) ---")
    print(
        f"transcribe={r.transcribe_seconds:.2f}s RTF={r.rtf:.3f} "
        f"lang={r.language} lang_prob={r.language_probability}"
    )
    print(
        f"segments={r.segment_count} words={r.word_count} "
        f"coverage={r.covered_seconds:.1f}s ({r.coverage_pct:.1f}%)"
    )
    print(
        f"avg_logprob={r.avg_logprob} no_speech_prob={r.no_speech_prob} "
        f"compression_ratio={r.compression_ratio}"
    )
    print(
        f"is_unusable_transcription={r.is_unusable} max_consecutive_repeat_segments={r.max_repeat_run} "
        f"repeated_5gram_hits={r.repeated_ngram_hits}"
    )
    print(f"tail segments: {r.tail_segments_preview}")
    print(f"text preview: {r.text_preview!r}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio", type=Path, default=_DEFAULT_SOURCE_WAV)
    parser.add_argument("--seconds", type=float, default=400.0)
    args = parser.parse_args()

    if not args.audio.exists():
        print(f"FAILED: audio fixture not found: {args.audio}")
        return 1

    from scripts.benchmark_processing_pipeline import _build_benchmark_wav
    from app.services.transcription.audio import extract_audio
    from app.core.config import get_settings
    from faster_whisper import WhisperModel

    wav_bytes = _build_benchmark_wav(args.audio, args.seconds)
    audio, duration = extract_audio(wav_bytes)
    print(f"Decoded benchmark audio: {duration:.1f}s, {audio.shape[0]} samples @ 16kHz mono float32")

    settings = get_settings()
    # Forced to "base" regardless of this dev environment's `.env`
    # (`WHISPER_MODEL_SIZE=large-v3-turbo` there overrides the `base` default
    # in `app.core.config` / `.env.example`) -- the task is explicitly to
    # evaluate language-detection/hallucination config changes on `base`
    # without changing the production model, so this experiment must hold
    # the model fixed at `base` independent of whatever this machine's local
    # `.env` currently happens to say.
    model_size = "base"
    print(
        f"Loading model: size={model_size!r} (settings.whisper_model_size={settings.whisper_model_size!r} "
        f"-- overridden here to match the task's fixed-'base' requirement) "
        f"device={settings.whisper_device!r} compute_type={settings.whisper_compute_type!r}"
    )
    try:
        model = WhisperModel(
            model_size,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
            local_files_only=True,
        )
    except Exception:
        model = WhisperModel(
            model_size,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )

    results: list[ConfigResult] = []

    # A. Current production config (faster_whisper.py FasterWhisperProvider.transcribe)
    results.append(
        _run_config(
            model, "A_current", "multilingual=True, condition_on_previous_text=False, vad_thr=0.35, no_speech_thr=0.4",
            audio,
            beam_size=1,
            vad_filter=True,
            vad_parameters=dict(threshold=0.35),
            no_speech_threshold=0.4,
            multilingual=True,
            condition_on_previous_text=False,
        )
    )

    # B. Forced English, otherwise identical to A
    results.append(
        _run_config(
            model, "B_forced_en", "language='en', condition_on_previous_text=False, vad_thr=0.35, no_speech_thr=0.4",
            audio,
            beam_size=1,
            vad_filter=True,
            vad_parameters=dict(threshold=0.35),
            no_speech_threshold=0.4,
            language="en",
            condition_on_previous_text=False,
        )
    )

    # C. Forced English + condition_on_previous_text=True. With the language
    # pinned (no more language-switch risk within a job), the reason A
    # disabled conditioning (cross-language prompt contamination, see
    # faster_whisper.py) no longer applies, and conditioning is Whisper's
    # normal way of using prior context to resolve ambiguous words --
    # justified only if B doesn't already regress vs. A and this doesn't
    # introduce repeat-loop hallucination.
    results.append(
        _run_config(
            model, "C_forced_en_conditioned", "language='en', condition_on_previous_text=True, vad_thr=0.35, no_speech_thr=0.4",
            audio,
            beam_size=1,
            vad_filter=True,
            vad_parameters=dict(threshold=0.35),
            no_speech_threshold=0.4,
            language="en",
            condition_on_previous_text=True,
        )
    )

    for r in results:
        _print_result(r)

    print("\n" + "=" * 100)
    header = f"{'config':<26}{'time(s)':>9}{'RTF':>7}{'lang':>6}{'segs':>6}{'words':>7}{'cov%':>7}{'unusable':>10}{'maxrep':>8}{'ngram3+':>9}"
    print(header)
    print("-" * len(header))
    for r in results:
        print(
            f"{r.name:<26}{r.transcribe_seconds:>9.2f}{r.rtf:>7.3f}{(r.language or '?'):>6}"
            f"{r.segment_count:>6}{r.word_count:>7}{r.coverage_pct:>7.1f}"
            f"{str(r.is_unusable):>10}{r.max_repeat_run:>8}{r.repeated_ngram_hits:>9}"
        )
    print("=" * 100)

    return 0


if __name__ == "__main__":
    sys.exit(main())
