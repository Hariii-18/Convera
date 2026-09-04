"""Benchmarks the full recorded-meeting processing pipeline
(`processing_service.execute_processing_job`) end to end against a real,
duration-representative audio file, using the `[timing]` log lines already
emitted by `processing_service` / `pipeline_service` / `mfcc_diarizer` /
`subprocess_runner`.

Exercises the real production code path (not a reimplementation): seeds a
throwaway user/meeting/upload/processing_job row, then calls
`execute_processing_job` exactly as the FastAPI `BackgroundTasks` worker
would, and parses the timing lines it (and the stages it calls) emit into a
per-stage report with percentage of total wall time.

`download_upload` is monkeypatched to read the benchmark WAV from local disk
instead of real Supabase Storage -- storage transfer speed is infra/network
-dependent and none of the requested optimizations touch it, so this keeps
the benchmark focused on the CPU/AI pipeline stages actually being audited
(decode, transcribe, diarize, align, normalize, summarize, timeline, notes).
`delete_file` is monkeypatched to a no-op for the same reason during cleanup
(there is no real storage object to delete).

The only real audio fixture in the repo (`.audit/test_meeting_multispeaker.wav`,
~50s of real multi-speaker speech) is looped with short silence gaps to reach
a duration comparable to the user's reported ~7-minute recording -- DSP/
inference cost scales with duration and speech density, which looping
preserves, though it is not a *novel* 7-minute recording. Override with
`--audio` to point at a real longer recording instead.

Usage:
  python -m scripts.benchmark_processing_pipeline
  python -m scripts.benchmark_processing_pipeline --seconds 420
  python -m scripts.benchmark_processing_pipeline --audio path/to/real_meeting.wav
  python -m scripts.benchmark_processing_pipeline --keep   # leave DB rows for inspection
"""

from __future__ import annotations

import argparse
import asyncio
import io
import logging
import re
import sys
import time
import uuid
import wave
from pathlib import Path
from unittest.mock import patch

TEST_EMAIL = "benchmark-processing-pipeline@convera.test"
_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_SOURCE_WAV = _REPO_ROOT / ".audit" / "test_meeting_multispeaker.wav"

_TIMING_RE = re.compile(r"\[timing\]\s+(.+?)\s+elapsed=([\d.]+)s")
_UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_TOKEN_RE = re.compile(r"\b(job|meeting|start|end)\b")

# Top-level sequential stages of `execute_processing_job` -- these sum to the
# reported total. Everything else captured ("diarization vad", "transcription
# child model_load(...)", "transcription process_spawn", ...) is a *detail*
# breakdown of one of these and is reported separately, not summed into the
# total (avoids double-counting a stage and its own sub-stages).
_TOP_LEVEL_STAGES = [
    "download_upload",
    "extract_audio",
    "transcription",
    "diarization",
    "save_transcript",
    "release_transcription_resources",
    "normalize",
    "summary",
    "timeline",
    "meeting_notes",
    "finalization",
]


class _TimingCollector(logging.Handler):
    """Captures every `[timing] ... elapsed=X.XXXs` log line emitted while a
    benchmark run is in flight, from this process AND from the transcription
    child process (which shares this process's stdout/stderr, so its own
    `[timing]` logs -- configured via `logging.basicConfig` in the child --
    interleave into the same stream)."""

    def __init__(self) -> None:
        super().__init__()
        self.rows: list[tuple[str, float]] = []

    def emit(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        match = _TIMING_RE.search(message)
        if not match:
            return
        raw_label, secs = match.group(1), float(match.group(2))
        label = _UUID_RE.sub("", raw_label)
        label = _TOKEN_RE.sub("", label)
        label = re.sub(r"\s+", " ", label).strip()
        self.rows.append((label, secs))


def _build_benchmark_wav(source: Path, target_seconds: float) -> bytes:
    with wave.open(str(source), "rb") as w:
        params = w.getparams()
        frames = w.readframes(w.getnframes())
    clip_seconds = params.nframes / params.framerate
    gap_seconds = 0.5
    repeats = max(1, round(target_seconds / (clip_seconds + gap_seconds)))
    silence = b"\x00" * int(params.framerate * gap_seconds) * params.sampwidth * params.nchannels

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setparams(params)
        for i in range(repeats):
            out.writeframes(frames)
            if i != repeats - 1:
                out.writeframes(silence)
    actual_seconds = repeats * clip_seconds + (repeats - 1) * gap_seconds
    print(
        f"Built benchmark audio: {repeats}x loop of {source.name} "
        f"({clip_seconds:.1f}s each) -> {actual_seconds:.1f}s total"
    )
    return buffer.getvalue()


def _get_or_create_test_user(db):
    from app.models.user import User

    user = db.query(User).filter(User.email == TEST_EMAIL).first()
    if user is not None:
        return user
    user = User(
        email=TEST_EMAIL,
        full_name="Benchmark Processing Pipeline",
        hashed_password="not-a-real-hash",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _print_report(rows: list[tuple[str, float]]) -> float:
    totals: dict[str, float] = {}
    order: list[str] = []
    for label, secs in rows:
        if label not in totals:
            order.append(label)
            totals[label] = 0.0
        totals[label] += secs

    top_level = [(label, totals[label]) for label in _TOP_LEVEL_STAGES if label in totals]
    grand_total = sum(secs for _, secs in top_level)

    print("\n" + "=" * 72)
    print(f"{'STAGE':<38}{'SECONDS':>12}{'% OF TOTAL':>15}")
    print("-" * 72)
    for label, secs in top_level:
        pct = (secs / grand_total * 100) if grand_total else 0.0
        print(f"{label:<38}{secs:>12.3f}{pct:>14.1f}%")
    print("-" * 72)
    print(f"{'TOTAL':<38}{grand_total:>12.3f}{100.0:>14.1f}%")
    print("=" * 72)

    detail_labels = [label for label in order if label not in _TOP_LEVEL_STAGES]
    if detail_labels:
        print("\nDetail (sub-stage breakdown, not summed into total above):")
        for label in detail_labels:
            print(f"    {label:<50}{totals[label]:>10.3f}s")

    return grand_total


async def _run_once(job_id: uuid.UUID) -> None:
    from app.services.processing_service import execute_processing_job

    await execute_processing_job(job_id)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", type=Path, default=_DEFAULT_SOURCE_WAV)
    parser.add_argument("--seconds", type=float, default=400.0, help="target benchmark audio duration")
    parser.add_argument("--keep", action="store_true", help="do not delete the seeded meeting afterward")
    args = parser.parse_args()

    if not args.audio.exists():
        print(f"FAILED: audio fixture not found: {args.audio}")
        return 1

    from app.crud.meeting import create_meeting
    from app.crud.upload import create_upload
    from app.db.session import SessionLocal
    from app.schemas.meeting import MeetingCreate
    from app.services import meeting_service
    from app.services.meeting_service import delete_meeting_cascade
    from app.services.processing_service import queue_processing_job
    from app.workers import processor

    audio_bytes = _build_benchmark_wav(args.audio, args.seconds)

    db = SessionLocal()
    try:
        user = _get_or_create_test_user(db)
        meeting = create_meeting(
            db,
            user_id=user.id,
            meeting_in=MeetingCreate(
                title=f"benchmark-{uuid.uuid4().hex[:8]}", source_type="upload-recording"
            ),
        )
        upload = create_upload(
            db,
            user_id=user.id,
            meeting_id=meeting.id,
            original_filename="benchmark.wav",
            stored_filename=f"{uuid.uuid4()}.wav",
            storage_path=f"benchmark/{uuid.uuid4()}.wav",
            bucket="benchmark",
            mime_type="audio/wav",
            size_bytes=len(audio_bytes),
        )
        job = queue_processing_job(db, upload=upload, user=user)
        job_id = job.id
        meeting_id = meeting.id
        user_id = user.id
    finally:
        db.close()

    collector = _TimingCollector()
    collector.setLevel(logging.INFO)
    root_logger = logging.getLogger()
    prior_level = root_logger.level
    root_logger.addHandler(collector)
    root_logger.setLevel(logging.INFO)

    print(f"Running execute_processing_job for benchmark job {job_id} (meeting {meeting_id})...")
    t0 = time.perf_counter()
    try:
        with patch.object(processor, "download_file", return_value=audio_bytes):
            asyncio.run(_run_once(job_id))
    finally:
        root_logger.removeHandler(collector)
        root_logger.setLevel(prior_level)
    wall_elapsed = time.perf_counter() - t0

    print(f"\nWall-clock elapsed: {wall_elapsed:.3f}s")
    _print_report(collector.rows)

    db = SessionLocal()
    try:
        from app.crud.processing_job import get_processing_job_by_id

        final_job = get_processing_job_by_id(db, job_id)
        print(f"\nFinal job status: {final_job.status if final_job else 'MISSING'}")
        if final_job is not None and final_job.status != "completed":
            print(f"WARNING: job did not complete (status={final_job.status}, error={final_job.error_message!r})")

        if not args.keep:
            from app.crud.meeting import get_meeting

            meeting = get_meeting(db, meeting_id, user_id)
            if meeting is not None:
                with patch.object(meeting_service, "delete_file", return_value=None):
                    delete_meeting_cascade(db, meeting)
                print("Cleaned up benchmark meeting.")
        else:
            print(f"--keep set: benchmark meeting {meeting_id} left in place.")
    finally:
        db.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
