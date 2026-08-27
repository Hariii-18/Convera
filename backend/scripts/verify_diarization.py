"""Verify the MFCC diarization pipeline (`app.services.diarization`) end to
end against a real audio file, through the same `extract_audio` path the
processing worker uses for recorded meetings.

No multi-speaker fixture ships in the repo, so when no path is given this
synthesizes one with `espeak-ng` (three distinct voices/pitches, one
returning after the others) rather than falling back to a silent/tone clip
-- silence has no voice identity to diarize, so it can't exercise clustering
at all. Pass `--audio`/`--ground-truth` to point at a real recording instead
(ground truth is optional and only used to score accuracy, not required for
the pipeline to run).

Checks:
  A. Every predicted segment is ordered and non-overlapping.
  B. Running `diarize` twice on the same audio produces byte-identical
     output (repeatability).
  C. (only with ground truth) the predicted `speaker_key` count matches the
     real speaker count -- neither collapsed together nor split apart.
  D. (only with ground truth) each real speaker's talk time maps
     predominantly to one `speaker_key`, and different real speakers map to
     different keys -- i.e. one stable key per voice, and a speaker who
     returns later gets the *same* key, not a new one. This is also what
     exercises "one speaker -> one key" for a single-speaker recording and
     "arbitrary N speakers" for an N-voice one.

Usage:
  python -m scripts.verify_diarization
  python -m scripts.verify_diarization --audio path/to/meeting.wav
  python -m scripts.verify_diarization --audio meeting.wav --ground-truth truth.json
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

from app.services.diarization.base import DiarizationSegment
from app.services.diarization.factory import get_diarization_provider
from app.services.transcription.audio import extract_audio

_SR = 22050

# (voice, pitch, speed, text) per line; "A" returns after "B" and "C" to
# exercise stable-label-on-return (check D below).
_SCRIPT = [
    ("A", "en-us", 15, 160, "Good morning everyone, thanks for joining. Let's start with the quarterly numbers."),
    ("B", "en-gb", 95, 175, "Sure, revenue was up twelve percent compared to last quarter, which is great news."),
    ("A", "en-us", 15, 160, "That's a solid improvement. What drove most of that growth this time around."),
    ("C", "en-gb-x-rp", 55, 150, "I think it was mainly the new product launch and the marketing push in March."),
    ("B", "en-gb", 95, 175, "Agreed, and customer retention also improved significantly during that period."),
    ("A", "en-us", 15, 160, "Great, let's make sure we keep that momentum going into the next quarter."),
    ("C", "en-gb-x-rp", 55, 150, "I will put together a follow up plan and share it with the team by Friday."),
]
_GAP_S = 0.6


def _synthesize_meeting(tmp_dir: Path) -> tuple[Path, list[dict]]:
    import numpy as np

    chunks = []
    ground_truth = []
    t = 0.0
    for i, (speaker, voice, pitch, speed, text) in enumerate(_SCRIPT):
        seg_path = tmp_dir / f"seg{i}.wav"
        subprocess.run(
            ["espeak-ng", "-v", voice, "-p", str(pitch), "-s", str(speed), "-w", str(seg_path), text],
            check=True,
            capture_output=True,
        )
        with wave.open(str(seg_path)) as w:
            assert w.getframerate() == _SR and w.getsampwidth() == 2 and w.getnchannels() == 1
            samples = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")
        dur = samples.shape[0] / _SR
        ground_truth.append({"speaker": speaker, "start": round(t, 2), "end": round(t + dur, 2)})
        chunks.append(samples)
        t += dur
        chunks.append(np.zeros(int(_GAP_S * _SR), dtype="<i2"))
        t += _GAP_S

    full = np.concatenate(chunks)
    out_path = tmp_dir / "meeting.wav"
    with wave.open(str(out_path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(_SR)
        out.writeframes(full.tobytes())
    return out_path, ground_truth


def _check_ordered_non_overlapping(segments: list[DiarizationSegment]) -> list[str]:
    problems = []
    for prev, cur in zip(segments, segments[1:]):
        if cur.start < prev.start:
            problems.append(f"out of order: {prev} then {cur}")
        if cur.start < prev.end:
            problems.append(f"overlap: {prev} then {cur}")
    return problems


def _score_against_ground_truth(
    segments: list[DiarizationSegment], ground_truth: list[dict]
) -> list[str]:
    problems = []
    overlap: dict[str, dict[str, float]] = {}
    for truth in ground_truth:
        bucket = overlap.setdefault(truth["speaker"], {})
        for seg in segments:
            ov = min(seg.end, truth["end"]) - max(seg.start, truth["start"])
            if ov > 0:
                bucket[seg.speaker_key] = bucket.get(seg.speaker_key, 0.0) + ov

    dominant_key: dict[str, str] = {}
    for true_speaker, bucket in overlap.items():
        if not bucket:
            problems.append(f"real speaker {true_speaker!r} has no predicted overlap at all")
            continue
        total = sum(bucket.values())
        key, secs = max(bucket.items(), key=lambda kv: kv[1])
        purity = secs / total
        dominant_key[true_speaker] = key
        print(f"    real speaker {true_speaker!r} -> predicted {key!r} ({purity:.0%} of its talk time)")
        if purity < 0.7:
            problems.append(f"real speaker {true_speaker!r} split across predicted keys (purity {purity:.0%})")

    if len(set(dominant_key.values())) != len(dominant_key):
        problems.append(f"two different real speakers mapped to the same predicted key: {dominant_key}")

    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", type=Path, default=None)
    parser.add_argument("--ground-truth", type=Path, default=None)
    args = parser.parse_args()

    ground_truth: list[dict] | None = None
    tmp_ctx = None
    if args.audio is not None:
        audio_path = args.audio
        if args.ground_truth is not None:
            ground_truth = json.loads(args.ground_truth.read_text())
    else:
        print("No --audio given: synthesizing a 3-voice test recording with espeak-ng...")
        tmp_ctx = tempfile.TemporaryDirectory()
        audio_path, ground_truth = _synthesize_meeting(Path(tmp_ctx.name))
        print(f"OK: synthesized {audio_path} ({len(_SCRIPT)} turns, 3 voices)")

    try:
        waveform, duration = extract_audio(audio_path.read_bytes())
    except Exception as exc:  # noqa: BLE001 (top-level diagnostic script)
        print(f"FAILED: audio extraction failed: {exc}")
        return 1
    print(f"OK: extracted {waveform.shape[0]} samples ({duration:.2f}s)")

    provider = get_diarization_provider()
    run1 = provider.diarize(waveform)
    run2 = provider.diarize(waveform)

    print(f"\nrun 1: {len(run1)} segment(s)")
    for seg in run1:
        print(f"    {seg.start:6.2f}s - {seg.end:6.2f}s  {seg.speaker_key}")

    problems: list[str] = []

    if run1 != run2:
        problems.append("run 1 and run 2 produced different output (not repeatable)")
    else:
        print("\nOK: run 1 and run 2 are byte-identical (repeatable)")

    problems.extend(_check_ordered_non_overlapping(run1))

    speaker_keys = {seg.speaker_key for seg in run1}
    print(f"\ndistinct speaker_key count: {len(speaker_keys)} ({sorted(speaker_keys)})")
    expected_speakers = len({g["speaker"] for g in ground_truth}) if ground_truth is not None else None
    if expected_speakers is not None and len(speaker_keys) != expected_speakers:
        problems.append(f"expected {expected_speakers} speaker_key(s) (per ground truth), got {len(speaker_keys)}")

    if ground_truth is not None:
        print("\nscoring against ground truth:")
        problems.extend(_score_against_ground_truth(run1, ground_truth))

    if tmp_ctx is not None:
        tmp_ctx.cleanup()

    if problems:
        print("\nFAILED:")
        for p in problems:
            print(f"  - {p}")
        return 1

    print("\nOK: all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
