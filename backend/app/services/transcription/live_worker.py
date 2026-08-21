"""Phase 5: a persistent Faster-Whisper worker process for one live meeting
session.

This is deliberately a *different* shape from `subprocess_runner.py`'s
one-shot-job-per-child model: a live session needs the same model loaded
once and then fed a stream of successive audio windows for its whole
lifetime, not one child spun up per job. But the underlying lesson is
identical (see `subprocess_runner.py`'s docstring) -- the CTranslate2 worker
that backs `WhisperModel` must never live inside the long-running FastAPI
process, so this still runs the model in a dedicated child process, started
when the live session's WebSocket connects and terminated (via the same
`terminate_process` escalation used for recorded jobs) the moment the
session stops, fails, or the socket drops.

Live Meeting V1 is English-only (see module docstring in
`app.services.transcription.faster_whisper` for why the recorded-upload path
uses `multilingual=True` instead -- that behavior is intentionally not
reused here): `language="en"` is passed explicitly rather than leaving
language auto-detection/multilingual switching enabled.
"""

from __future__ import annotations

import asyncio
import logging
import multiprocessing as mp
import threading
import traceback
from multiprocessing.connection import Connection

import numpy as np

from app.services.transcription.base import TranscriptSegment
from app.services.transcription.process_utils import terminate_process

logger = logging.getLogger("converra")

_MP_CONTEXT = mp.get_context("spawn")

# One session's worker only ever has one window in flight (the pipeline
# feeds windows sequentially), so a depth-1 request queue is enough --
# it exists mainly so `put_nowait` has somewhere to raise `queue.Full` if a
# caller ever violates that assumption instead of silently blocking forever.
_REQUEST_QUEUE_MAXSIZE = 2

WORKER_READY_TIMEOUT_SECONDS = 60.0
WINDOW_TRANSCRIBE_TIMEOUT_SECONDS = 45.0
TERMINATE_JOIN_TIMEOUT_SECONDS = 10.0

_READY = "__ready__"
_INIT_ERROR = "__init_error__"
_SHUTDOWN = "__shutdown__"


def _worker_entrypoint(
    request_queue: mp.Queue,
    result_queue: mp.Queue,
    model_size: str,
    device: str,
    compute_type: str,
) -> None:
    """Runs in the child process. Loads the model once, then services
    successive `(job_id, waveform)` requests until told to stop or the pipe
    is torn down from the parent side.
    """
    logging.basicConfig(level=logging.INFO)
    try:
        from faster_whisper import WhisperModel

        logger.info(
            "live-transcription worker loading model '%s' (device=%s, compute_type=%s)",
            model_size, device, compute_type,
        )
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        logger.info("live-transcription worker model loaded")
    except BaseException:
        result_queue.put((_INIT_ERROR, traceback.format_exc()))
        return

    result_queue.put((_READY,))

    while True:
        try:
            job = request_queue.get()
        except (EOFError, OSError):
            break
        if job is None:
            break

        job_id, audio = job
        try:
            # Same proven settings as the recorded-upload base pass (see
            # `faster_whisper.py`), minus `multilingual=True` -- Live
            # Meeting V1 is English-only, so the language is pinned instead
            # of re-detected per window.
            segments_iter, _info = model.transcribe(
                audio,
                task="transcribe",
                language="en",
                beam_size=1,
                vad_filter=True,
                condition_on_previous_text=False,
            )
            segments = [
                (segment.start, segment.end, segment.text)
                for segment in segments_iter
                if segment.text.strip()
            ]
            result_queue.put((job_id, "ok", segments))
        except BaseException:
            result_queue.put((job_id, "error", traceback.format_exc()))


class LiveTranscriptionWorker:
    """Owns one child process (and its model) for the lifetime of one live
    meeting session's WebSocket connection.

    Not safe for concurrent `transcribe()` calls -- the live pipeline only
    ever has one window in flight at a time, which is what keeps the
    request/result queues simple (no need for a worker pool).
    """

    def __init__(self) -> None:
        self._process: mp.process.BaseProcess | None = None
        self._request_queue: mp.Queue | None = None
        self._result_queue: mp.Queue | None = None
        self._dispatcher_thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._ready_future: asyncio.Future | None = None
        self._pending: dict[int, asyncio.Future] = {}
        self._next_job_id = 0
        self._stopped = False

    async def start(self, *, model_size: str, device: str, compute_type: str) -> None:
        self._loop = asyncio.get_running_loop()
        self._request_queue = _MP_CONTEXT.Queue(maxsize=_REQUEST_QUEUE_MAXSIZE)
        self._result_queue = _MP_CONTEXT.Queue()
        self._process = _MP_CONTEXT.Process(
            target=_worker_entrypoint,
            args=(self._request_queue, self._result_queue, model_size, device, compute_type),
            daemon=True,
        )
        self._process.start()
        logger.info("live-transcription worker process started pid=%s", self._process.pid)

        self._ready_future = self._loop.create_future()
        self._dispatcher_thread = threading.Thread(target=self._dispatch_loop, daemon=True)
        self._dispatcher_thread.start()

        try:
            await asyncio.wait_for(self._ready_future, timeout=WORKER_READY_TIMEOUT_SECONDS)
        except asyncio.TimeoutError as exc:
            await self.stop()
            raise RuntimeError(
                f"live-transcription worker did not become ready within "
                f"{WORKER_READY_TIMEOUT_SECONDS}s"
            ) from exc

    def _dispatch_loop(self) -> None:
        assert self._result_queue is not None
        while True:
            try:
                item = self._result_queue.get()
            except (EOFError, OSError):
                break

            kind = item[0]
            if kind == _SHUTDOWN:
                break
            if kind == _READY:
                loop = self._loop
                if loop is not None:
                    loop.call_soon_threadsafe(self._resolve_ready, None)
                continue
            if kind == _INIT_ERROR:
                loop = self._loop
                if loop is not None:
                    loop.call_soon_threadsafe(self._resolve_ready, item[1])
                continue

            # Otherwise `kind` is a job_id and the message is
            # (job_id, "ok" | "error", payload).
            job_id = kind
            status = item[1]
            payload = item[2] if len(item) > 2 else None
            loop = self._loop
            if loop is not None:
                loop.call_soon_threadsafe(self._resolve_job, job_id, status, payload)

    def _resolve_ready(self, error: str | None) -> None:
        future = self._ready_future
        if future is None or future.done():
            return
        if error is not None:
            future.set_exception(
                RuntimeError(f"live-transcription worker failed to load model:\n{error}")
            )
        else:
            future.set_result(None)

    def _resolve_job(self, job_id: int, status: str, payload: object) -> None:
        future = self._pending.pop(job_id, None)
        if future is None or future.done():
            return
        if status == "ok":
            future.set_result(payload)
        else:
            future.set_exception(RuntimeError(f"live-transcription worker failed:\n{payload}"))

    async def transcribe(self, audio: np.ndarray) -> list[TranscriptSegment]:
        if self._process is None or not self._process.is_alive():
            raise RuntimeError("live-transcription worker is not running")

        loop = self._loop
        assert loop is not None
        job_id = self._next_job_id
        self._next_job_id += 1
        future: asyncio.Future = loop.create_future()
        self._pending[job_id] = future

        assert self._request_queue is not None
        self._request_queue.put((job_id, audio))
        try:
            raw_segments = await asyncio.wait_for(future, timeout=WINDOW_TRANSCRIBE_TIMEOUT_SECONDS)
        finally:
            self._pending.pop(job_id, None)

        return [
            TranscriptSegment(start=start, end=end, text=text.strip())
            for start, end, text in raw_segments
        ]

    async def stop(self) -> None:
        if self._stopped:
            return
        self._stopped = True

        if self._process is not None:
            await asyncio.to_thread(terminate_process, self._process, TERMINATE_JOIN_TIMEOUT_SECONDS)

        for future in list(self._pending.values()):
            if not future.done():
                future.set_exception(RuntimeError("live-transcription worker stopped"))
        self._pending.clear()

        if self._result_queue is not None:
            try:
                self._result_queue.put((_SHUTDOWN,))
            except Exception:
                pass
        if self._dispatcher_thread is not None:
            self._dispatcher_thread.join(timeout=5)

    def pid(self) -> int | None:
        return self._process.pid if self._process is not None else None

    def is_alive(self) -> bool:
        return self._process is not None and self._process.is_alive()
