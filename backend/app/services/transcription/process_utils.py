"""Shared child-process teardown for anything that owns a CTranslate2 Whisper
model in a dedicated OS process (see `subprocess_runner.py`'s module
docstring for why that isolation exists at all).

Both the per-job recorded-upload worker (`subprocess_runner.py`) and the
persistent live-transcription worker (`live_worker.py`) need the exact same
guarantee: the child is dead and reaped before the caller proceeds, no matter
whether it exited cleanly, is wedged, or already crashed.
"""

from __future__ import annotations

import logging
import multiprocessing as mp

logger = logging.getLogger("converra")

DEFAULT_TERMINATE_JOIN_TIMEOUT_SECONDS = 10


def terminate_process(
    process: mp.process.BaseProcess,
    join_timeout: float = DEFAULT_TERMINATE_JOIN_TIMEOUT_SECONDS,
) -> None:
    """Ensures `process` is dead and reaped before returning, escalating from
    terminate() (SIGTERM) to kill() (SIGKILL) if it doesn't exit promptly, so
    the OS reclaims everything it allocated -- including any CTranslate2
    worker it started under the hood -- no matter what.
    """
    pid = process.pid
    if process.is_alive():
        process.terminate()
        process.join(join_timeout)
    if process.is_alive():
        logger.warning("Worker process pid=%s ignored terminate(); killing", pid)
        process.kill()
        process.join(join_timeout)
    exitcode = process.exitcode
    process.close()
    logger.info("Worker process pid=%s reaped (exitcode=%s)", pid, exitcode)
