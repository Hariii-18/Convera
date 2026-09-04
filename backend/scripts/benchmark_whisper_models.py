"""Controlled benchmark comparing CPU Whisper model sizes for Converra.

Answers one question: which `faster-whisper` model size gives the best
speed/accuracy trade-off for CPU deployment? Read-only with respect to
production: it never touches `whisper_model_size` in config, never mutates
the database, and exercises the exact production transcription code path
(`FasterWhisperProvider` from `app.services.transcription.faster_whisper`,
same `beam_size`/`vad_filter`/`condition_on_previous_text` settings a real
job would use) with only the model size varied.

Each (model, run) pair is transcribed in a dedicated spawned child process --
mirroring the isolation `subprocess_runner.py` already uses in production --
so no model weights accumulate across runs and each run's peak working-set
memory (via the Windows `GetProcessMemoryInfo` API; there is no `psutil` in
this env, see `verify_processing_cancellation_and_retry.py`) reflects that
one model alone.

Audio: the only real speech fixture in the repo
(`.audit/test_meeting_multispeaker.wav`, ~50s of real multi-speaker speech)
looped with short silence gaps to a representative ~6-7 minute duration,
reusing `benchmark_processing_pipeline._build_benchmark_wav` so every model
sees byte-identical audio. Decoded via the real `extract_audio` (PyAV decode
+ resample to 16kHz mono float32) so the waveform each model sees is exactly
what production would hand it.

Cold vs warm: run 1 for each model is "cold" -- for `small`/`medium` (not
pre-cached on this machine) that includes the Hugging Face download; for
`base` (already cached) it's a cold OS file-cache read. Run 2 ("warm") reads
the now-locally-cached weights again in a fresh process, isolating steady-
state load time from first-time cost.

Usage:
  python -m scripts.benchmark_whisper_models
  python -m scripts.benchmark_whisper_models --models base small
  python -m scripts.benchmark_whisper_models --runs 3 --seconds 420
  python -m scripts.benchmark_whisper_models --out-dir ../.audit/whisper_bench
"""

from __future__ import annotations

import argparse
import ctypes
import json
import multiprocessing as mp
import sys
import time
from dataclasses import asdict, dataclass
from multiprocessing.connection import Connection
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_SOURCE_WAV = _REPO_ROOT / ".audit" / "test_meeting_multispeaker.wav"
_DEFAULT_MODELS = ["base", "small", "medium"]

_MP_CONTEXT = mp.get_context("spawn")


@dataclass
class RunResult:
    model: str
    run_index: int
    cache_state: str  # "cold" | "warm"
    model_load_seconds: float
    transcribe_seconds: float
    realtime_factor: float  # transcribe_seconds / audio_duration_seconds
    peak_working_set_mb: float | None
    audio_duration_seconds: float
    language: str | None
    segment_count: int
    word_count: int
    avg_logprob: float | None
    no_speech_prob: float | None
    compression_ratio: float | None
    text_preview: str
    error: str | None = None


def _peak_working_set_mb() -> float | None:
    """Peak working-set size (bytes -> MB) of the *current* process, via the
    Win32 `GetProcessMemoryInfo` API on a pseudo-handle for the calling
    process. No extra dependency (no `psutil` in this env) and no polling
    thread needed -- Windows already tracks the high-water mark itself."""
    if sys.platform != "win32":
        return None

    class _ProcessMemoryCounters(ctypes.Structure):
        _fields_ = [
            ("cb", ctypes.c_ulong),
            ("PageFaultCount", ctypes.c_ulong),
            ("PeakWorkingSetSize", ctypes.c_size_t),
            ("WorkingSetSize", ctypes.c_size_t),
            ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
            ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
            ("PagefileUsage", ctypes.c_size_t),
            ("PeakPagefileUsage", ctypes.c_size_t),
        ]

    import ctypes.wintypes as wintypes

    # ctypes defaults foreign-function return types to `c_int` (32-bit),
    # which silently truncates the 64-bit pseudo-handle `GetCurrentProcess()`
    # returns (-1 as a 64-bit HANDLE, not as c_int) -- must be declared
    # explicitly or `GetProcessMemoryInfo` fails on a garbage handle.
    ctypes.windll.kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    ctypes.windll.psapi.GetProcessMemoryInfo.argtypes = [
        wintypes.HANDLE, ctypes.POINTER(_ProcessMemoryCounters), wintypes.DWORD,
    ]
    ctypes.windll.psapi.GetProcessMemoryInfo.restype = wintypes.BOOL

    counters = _ProcessMemoryCounters()
    counters.cb = ctypes.sizeof(_ProcessMemoryCounters)
    current_process = ctypes.windll.kernel32.GetCurrentProcess()
    ok = ctypes.windll.psapi.GetProcessMemoryInfo(current_process, ctypes.byref(counters), counters.cb)
    if not ok:
        return None
    return counters.PeakWorkingSetSize / (1024 * 1024)


def _worker_entrypoint(
    conn: Connection,
    model_size: str,
    run_index: int,
    cache_state: str,
    audio,
    sample_rate: int,
) -> None:
    """Runs in a dedicated spawned child process: loads exactly one model,
    transcribes exactly once, reports back, then exits (so the parent's
    Python heap and OS process table never accumulate models across runs)."""
    try:
        from app.services.transcription.faster_whisper import FasterWhisperProvider

        t0 = time.perf_counter()
        provider = FasterWhisperProvider(model_size=model_size)
        load_seconds = time.perf_counter() - t0

        t0 = time.perf_counter()
        result = provider.transcribe(audio, sample_rate=sample_rate)
        transcribe_seconds = time.perf_counter() - t0

        peak_mb = _peak_working_set_mb()
        rtf = transcribe_seconds / result.duration if result.duration else float("nan")

        conn.send(
            RunResult(
                model=model_size,
                run_index=run_index,
                cache_state=cache_state,
                model_load_seconds=load_seconds,
                transcribe_seconds=transcribe_seconds,
                realtime_factor=rtf,
                peak_working_set_mb=peak_mb,
                audio_duration_seconds=result.duration,
                language=result.language,
                segment_count=len(result.segments),
                word_count=result.word_count,
                avg_logprob=result.avg_logprob,
                no_speech_prob=result.no_speech_prob,
                compression_ratio=result.compression_ratio,
                text_preview=result.text[:400],
            )
        )
        conn.send(("segments", [(s.start, s.end, s.text) for s in result.segments]))
        conn.send(("full_text", result.text))
    except BaseException as exc:  # the child must report failure, never crash silently
        import traceback

        conn.send(
            RunResult(
                model=model_size,
                run_index=run_index,
                cache_state=cache_state,
                model_load_seconds=0.0,
                transcribe_seconds=0.0,
                realtime_factor=float("nan"),
                peak_working_set_mb=None,
                audio_duration_seconds=0.0,
                language=None,
                segment_count=0,
                word_count=0,
                avg_logprob=None,
                no_speech_prob=None,
                compression_ratio=None,
                text_preview="",
                error=f"{exc!r}\n{traceback.format_exc()}",
            )
        )
    finally:
        conn.close()


def _run_one(model_size: str, run_index: int, cache_state: str, audio, sample_rate: int) -> tuple[RunResult, list, str]:
    parent_conn, child_conn = _MP_CONTEXT.Pipe(duplex=False)
    process = _MP_CONTEXT.Process(
        target=_worker_entrypoint,
        args=(child_conn, model_size, run_index, cache_state, audio, sample_rate),
        daemon=True,
    )
    process.start()
    child_conn.close()
    try:
        result: RunResult = parent_conn.recv()
        _, segments = parent_conn.recv()
        _, full_text = parent_conn.recv()
    finally:
        parent_conn.close()
        process.join(120)
        if process.is_alive():
            process.kill()
            process.join(10)
        process.close()
    return result, segments, full_text


def _print_table(results: list[RunResult]) -> None:
    header = (
        f"{'model':<8}{'run':>4}{'cache':>7}{'load(s)':>10}{'xscribe(s)':>12}"
        f"{'RTF':>8}{'peakMB':>9}{'segs':>6}{'words':>7}{'lang':>6}"
    )
    print("\n" + "=" * len(header))
    print(header)
    print("-" * len(header))
    for r in results:
        if r.error:
            print(f"{r.model:<8}{r.run_index:>4}{r.cache_state:>7}  ERROR: {r.error.splitlines()[0]}")
            continue
        peak = f"{r.peak_working_set_mb:.0f}" if r.peak_working_set_mb is not None else "n/a"
        print(
            f"{r.model:<8}{r.run_index:>4}{r.cache_state:>7}{r.model_load_seconds:>10.2f}"
            f"{r.transcribe_seconds:>12.2f}{r.realtime_factor:>8.3f}{peak:>9}"
            f"{r.segment_count:>6}{r.word_count:>7}{(r.language or '?'):>6}"
        )
    print("=" * len(header))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models", nargs="+", default=_DEFAULT_MODELS)
    parser.add_argument("--runs", type=int, default=2, help="runs per model (>=2 to see cold vs warm)")
    parser.add_argument("--seconds", type=float, default=400.0, help="target benchmark audio duration (~6-7 min)")
    parser.add_argument("--audio", type=Path, default=_DEFAULT_SOURCE_WAV)
    parser.add_argument("--out-dir", type=Path, default=None, help="where to write per-run transcripts + JSON summary")
    args = parser.parse_args()

    if not args.audio.exists():
        print(f"FAILED: audio fixture not found: {args.audio}")
        return 1

    sys.path.insert(0, str(_BACKEND_ROOT))
    from scripts.benchmark_processing_pipeline import _build_benchmark_wav
    from app.services.transcription.audio import extract_audio

    wav_bytes = _build_benchmark_wav(args.audio, args.seconds)
    audio, duration = extract_audio(wav_bytes)
    print(f"Decoded benchmark audio: {duration:.1f}s, {audio.shape[0]} samples @ 16kHz mono float32")
    print(f"Models: {args.models}  runs/model: {args.runs}")

    out_dir = args.out_dir
    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)

    all_results: list[RunResult] = []
    for model_size in args.models:
        for run_index in range(1, args.runs + 1):
            cache_state = "cold" if run_index == 1 else "warm"
            print(f"\n--- {model_size} run {run_index} ({cache_state}) ---")
            t_wall = time.perf_counter()
            result, segments, full_text = _run_one(model_size, run_index, cache_state, audio, 16000)
            wall = time.perf_counter() - t_wall
            all_results.append(result)
            if result.error:
                print(f"ERROR: {result.error}")
                continue
            print(
                f"load={result.model_load_seconds:.2f}s transcribe={result.transcribe_seconds:.2f}s "
                f"(wall={wall:.2f}s) RTF={result.realtime_factor:.3f} "
                f"peak_working_set={result.peak_working_set_mb:.0f}MB "
                f"segments={result.segment_count} words={result.word_count} lang={result.language}"
            )
            if out_dir is not None:
                stem = f"{model_size}_run{run_index}_{cache_state}"
                (out_dir / f"{stem}.txt").write_text(full_text, encoding="utf-8")
                (out_dir / f"{stem}_segments.json").write_text(
                    json.dumps(segments, ensure_ascii=False, indent=2), encoding="utf-8"
                )

    _print_table(all_results)

    if out_dir is not None:
        summary_path = out_dir / "summary.json"
        summary_path.write_text(
            json.dumps([asdict(r) for r in all_results], ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"\nWrote per-run transcripts and {summary_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
