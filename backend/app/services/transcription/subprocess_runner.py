"""Owns the OS process boundary for the transcription phase of a job.

`faster-whisper`'s CTranslate2 backend loads model weights into a native
worker that isn't fully reclaimed by calling `.release()` /
`unload_model()` on the Python-visible model object: that call frees the
weights, but the CTranslate2 worker itself (a long-lived native thread pool
that behaves like a subprocess for memory-accounting purposes, ~470-670MB)
keeps running in *this* OS process. No amount of `del`, `gc.collect()`, or
cache-eviction on the Python side reaches it, because it was never Python
heap memory to begin with.

The only reliable fix is to never let that worker live in the parent
FastAPI process at all: run the whole transcription phase for a job (the
base-model pass, and the small-model fallback if the base pass is
unusable) inside a dedicated child process, and terminate that child --
not just its Python model object -- the moment the phase is done, whether
it succeeded, fell back, or raised. When the child process exits, the OS
reclaims everything it allocated, including anything CTranslate2 started
under the hood, regardless of what its own unload path does or doesn't do.
"""

from __future__ import annotations

import logging
import multiprocessing as mp
import threading
import traceback
import uuid
from multiprocessing.connection import Connection

import numpy as np

from app.services.transcription.base import TranscriptionResult, is_unusable_transcription
from app.services.transcription.process_utils import terminate_process

logger = logging.getLogger("converra")

# "spawn" (not the Linux default "fork") starts the child from a clean
# interpreter instead of duplicating this process's address space -- the
# parent's own asyncio loop, DB connections, and any native state must
# never end up inside the transcription worker.
_MP_CONTEXT = mp.get_context("spawn")

# Wall-clock budget for one job's base + fallback transcription passes to
# run and hand back a result before we conclude the child is wedged.
_RESULT_TIMEOUT_SECONDS = 60 * 60
# Grace period after terminate() before escalating to kill().
_TERMINATE_JOIN_TIMEOUT_SECONDS = 10

_active_lock = threading.Lock()
# Keyed by ProcessingJob.id so a cancellation can look up and kill the one
# process belonging to that job, rather than every transcription worker
# currently running in this FastAPI process.
_active_processes: dict[uuid.UUID, mp.process.BaseProcess] = {}


def _worker_entrypoint(
    conn: Connection,
    provider_name: str,
    base_model_size: str,
    fallback_model_size: str,
    audio: np.ndarray,
    sample_rate: int,
) -> None:
    """Entry point for the child process. Everything imported and loaded
    here -- including the CTranslate2 model and whatever native worker it
    starts -- lives only in this process and dies with it.
    """
    logging.basicConfig(level=logging.INFO)
    try:
        from app.services.transcription.factory import get_transcription_provider

        base_provider = get_transcription_provider(base_model_size)
        result = base_provider.transcribe(audio, sample_rate=sample_rate)
        model_used = base_model_size
        fallback_reason: str | None = None

        if is_unusable_transcription(result):
            fallback_reason = (
                f"base model '{base_model_size}' produced unusable output "
                f"(segments={len(result.segments)}, word_count={result.word_count})"
            )
            logger.warning(
                "Transcription fallback triggered: %s -> retrying with '%s'",
                fallback_reason, fallback_model_size,
            )
            fallback_provider = get_transcription_provider(fallback_model_size)
            fallback_result = fallback_provider.transcribe(audio, sample_rate=sample_rate)
            if is_unusable_transcription(fallback_result):
                logger.warning(
                    "Fallback model '%s' also produced unusable output (segments=%d, word_count=%d)",
                    fallback_model_size, len(fallback_result.segments), fallback_result.word_count,
                )
            result = fallback_result
            model_used = fallback_model_size

        conn.send(("ok", result, model_used, fallback_reason))
    except BaseException:  # the child must report every failure before exiting, never crash silently
        conn.send(("error", traceback.format_exc()))
    finally:
        conn.close()


def run_transcription_job(
    waveform: np.ndarray, *, job_id: uuid.UUID, sample_rate: int = 16000
) -> tuple[TranscriptionResult, str, str | None]:
    """Runs the full transcription phase for one job -- base model, with the
    configured fallback if the base pass is unusable -- in a dedicated
    child process, and guarantees that process is terminated and reaped
    before returning, success or failure. Blocking; call via
    `asyncio.to_thread`.

    Registers the child process under `job_id` for the duration of the call
    so `terminate_job_process(job_id)` can kill it from another thread (used
    by job cancellation) -- this phase otherwise has no interruption points
    of its own and can run for up to `_RESULT_TIMEOUT_SECONDS`.

    Returns `(result, model_used, fallback_reason)`, matching the previous
    in-process `transcribe_with_fallback` contract. Raises `RuntimeError` if
    the child process fails, is killed (including by a cancellation), or
    produces no result before it times out.
    """
    from app.core.config import get_settings

    settings = get_settings()
    parent_conn, child_conn = _MP_CONTEXT.Pipe(duplex=False)
    process = _MP_CONTEXT.Process(
        target=_worker_entrypoint,
        args=(
            child_conn,
            settings.transcription_provider,
            settings.whisper_model_size,
            settings.whisper_fallback_model_size,
            waveform,
            sample_rate,
        ),
        daemon=True,
    )
    with _active_lock:
        _active_processes[job_id] = process
    process.start()
    child_conn.close()  # only the child's end writes to this pipe
    logger.info(
        "Started transcription worker process pid=%s for job %s", process.pid, job_id
    )

    try:
        if not parent_conn.poll(_RESULT_TIMEOUT_SECONDS):
            raise RuntimeError(
                f"Transcription worker process (pid={process.pid}) produced no result "
                f"within {_RESULT_TIMEOUT_SECONDS}s"
            )
        try:
            outcome = parent_conn.recv()
        except EOFError as exc:
            raise RuntimeError(
                f"Transcription worker process (pid={process.pid}) exited without a result "
                f"(exit code {process.exitcode})"
            ) from exc

        if outcome[0] == "error":
            _, tb_text = outcome
            raise RuntimeError(f"Transcription worker process (pid={process.pid}) failed:\n{tb_text}")

        _, result, model_used, fallback_reason = outcome
        return result, model_used, fallback_reason
    finally:
        parent_conn.close()
        # Whoever pops the entry owns terminating it -- if `terminate_job_process`
        # already claimed it (cancellation), don't terminate/close the same
        # process object a second time from here.
        with _active_lock:
            owned_process = _active_processes.pop(job_id, None)
        if owned_process is not None:
            _terminate(owned_process)


def terminate_job_process(job_id: uuid.UUID) -> bool:
    """Immediately kills the transcription worker process for `job_id`, if one
    is currently running, instead of waiting for it to finish on its own.

    This is the mechanism that makes cancelling a job in the "processing"
    stage actually stop work: `run_transcription_job` has no interruption
    points inside the base/fallback transcription calls themselves, so
    without this, a cancelled job's worker keeps running -- and holding
    model memory -- until it completes or times out (up to
    `_RESULT_TIMEOUT_SECONDS`).

    Returns `True` if a process was found and terminated, `False` if this
    job had none running (e.g. it was cancelled before reaching the
    transcription stage). Safe to call concurrently with
    `run_transcription_job`'s own cleanup -- see the `finally` block there.
    """
    with _active_lock:
        process = _active_processes.pop(job_id, None)
    if process is None:
        return False
    logger.info(
        "Cancelling job %s: terminating transcription worker pid=%s", job_id, process.pid
    )
    _terminate(process)
    return True


def terminate_active_processes() -> None:
    """Defensive belt-and-suspenders cleanup: `run_transcription_job` always
    terminates its own child process in its `finally` block before
    returning, so under normal operation this finds nothing to do. Exists
    so the job pipeline's release-resources step can guarantee no
    transcription worker is attached to this FastAPI process before summary
    generation starts, even on a code path that doesn't call
    `run_transcription_job` at all (e.g. a retry resuming from an existing
    transcript).
    """
    with _active_lock:
        stragglers = list(_active_processes.items())
    for job_id, process in stragglers:
        logger.warning(
            "Reaping stray transcription worker pid=%s for job %s", process.pid, job_id
        )
        _terminate(process)
        with _active_lock:
            _active_processes.pop(job_id, None)


def _terminate(process: mp.process.BaseProcess) -> None:
    terminate_process(process, _TERMINATE_JOIN_TIMEOUT_SECONDS)
