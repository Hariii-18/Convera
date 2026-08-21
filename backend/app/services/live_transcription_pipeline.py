"""Phase 5: turns a live meeting session's accepted audio chunks into
near-real-time transcript segments.

Pipeline shape (see `app.api.v1.live_meetings` for the WebSocket that drives
this):

    accepted chunk bytes
        -> bounded asyncio queue        (backpressure without blocking recv)
        -> decode (existing PyAV path)  (`transcription.audio.extract_audio`)
        -> rolling overlap window
        -> `LiveTranscriptionWorker`    (owns the Faster-Whisper child process)
        -> dedup against already-committed text
        -> `on_message` callback        (queued for the WebSocket sender)

Chunk framing note: successive `MediaRecorder` blobs are fragments of one
WebM stream, not independently decodable files (only the first blob carries
the container header). So this decodes the *whole* byte stream accepted so
far on every cycle, rather than each chunk in isolation -- the same PyAV
path just fed a growing buffer. A session's accumulated audio is capped
(`_MAX_RAW_BYTES`) as a safety valve; this re-decode-from-scratch approach is
the one deliberate scaling limitation of this phase (see module docstring
note in the Phase 5 summary) and is fine at Live Meeting V1's session
lengths, but is not free -- it is O(n) per cycle, so O(n^2) over a very long
session.

Context/overlap strategy: rather than transcribing each new slice of audio
as an independent, contextless sentence (which mangles words split across a
chunk boundary), every cycle re-transcribes from `_OVERLAP_SECONDS` before
the last committed point through the newest audio, then only emits segments
that extend past what was already committed. This is a segment-level dedup,
not word-level alignment -- intentionally minimal, per Phase 5 scope.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from app.core.config import get_settings
from app.services.transcription.audio import AudioExtractionError, extract_audio
from app.services.transcription.live_worker import LiveTranscriptionWorker

logger = logging.getLogger("converra")

SAMPLE_RATE = 16000

# How far back to re-open the transcription window from the last committed
# point, so words split across a chunk boundary get re-decoded with context
# on both sides instead of being cut mid-word.
_OVERLAP_SECONDS = 2.0
# Skip a cycle if less than this much genuinely new audio has arrived --
# avoids paying for a full inference pass on a sliver of audio.
_MIN_NEW_AUDIO_SECONDS = 1.0
# Bounds how many decoded-but-not-yet-transcribed chunks can queue up before
# the pipeline stops accepting audio for transcription (item 5: bounded
# backpressure). At ~7s/chunk this is ~56s of slack.
_MAX_QUEUED_CHUNKS = 8
# Safety valve on the growing raw-byte buffer described above -- roughly
# tens of minutes of opus audio, comfortably past any Live Meeting V1 demo
# session, without letting memory grow completely unbounded.
_MAX_RAW_BYTES = 60 * 1024 * 1024
# Bounded wait for whatever's still queued to finish transcribing once the
# session stops -- draining must not hang the WebSocket teardown forever.
_DRAIN_TIMEOUT_SECONDS = 60.0

SendFn = Callable[[dict], Awaitable[None]]
FatalErrorFn = Callable[[str], Awaitable[None]]


class LiveTranscriptionPipeline:
    """One instance per live meeting session (one WebSocket connection)."""

    def __init__(self, *, send: SendFn, on_fatal_error: FatalErrorFn) -> None:
        self._send = send
        self._on_fatal_error = on_fatal_error
        self._worker = LiveTranscriptionWorker()
        self._audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=_MAX_QUEUED_CHUNKS)
        self._task: asyncio.Task | None = None
        self._raw_bytes = bytearray()
        self._committed_until = 0.0
        self._next_sequence = 0
        self._overloaded = False
        self._closed = False
        self._ready = False

    def is_ready(self) -> bool:
        return self._ready

    def start(self) -> None:
        self._task = asyncio.create_task(self._run())

    async def submit_chunk(self, payload: bytes) -> bool:
        """Enqueues an accepted audio chunk for transcription.

        Returns False if the transcription queue is unsafe to grow further
        (backpressure) -- the caller keeps ACKing/buffering audio for
        transport purposes regardless; only transcription of *future* audio
        stops. A single `transcription_error` is emitted the first time this
        happens, not once per subsequently-dropped chunk.
        """
        if self._closed or self._overloaded:
            return False
        try:
            self._audio_queue.put_nowait(payload)
            return True
        except asyncio.QueueFull:
            self._overloaded = True
            logger.warning("live-transcription queue overloaded; disabling further transcription")
            await self._send(
                {
                    "type": "transcription_error",
                    "message": "Live transcription is falling behind and will not process further audio this session.",
                }
            )
            return False

    async def _run(self) -> None:
        settings = get_settings()
        try:
            await self._worker.start(
                model_size=settings.whisper_model_size,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
            )
        except Exception as exc:
            logger.exception("live-transcription worker failed to start")
            await self._send({"type": "transcription_error", "message": "Live transcription failed to start."})
            await self._on_fatal_error(f"Live transcription worker failed to start: {exc}")
            return

        self._ready = True
        await self._send({"type": "transcription_ready"})
        logger.info("live-transcription worker ready pid=%s", self._worker.pid())

        while True:
            item = await self._audio_queue.get()
            if item is None:
                break
            try:
                await self._process_chunk(item)
            except Exception as exc:
                if not self._worker.is_alive():
                    logger.exception("live-transcription worker died mid-session")
                    await self._send(
                        {"type": "transcription_error", "message": "Live transcription worker crashed."}
                    )
                    await self._on_fatal_error(f"Live transcription worker crashed: {exc}")
                    return
                logger.exception("failed to transcribe a live audio window")
                await self._send(
                    {"type": "transcription_error", "message": "Failed to transcribe an audio chunk."}
                )
                # Keep the session alive -- one bad window doesn't corrupt
                # ordering for subsequent ones, `_committed_until` is untouched.

    async def _process_chunk(self, payload: bytes) -> None:
        self._raw_bytes.extend(payload)

        if len(self._raw_bytes) > _MAX_RAW_BYTES:
            self._overloaded = True
            await self._send(
                {
                    "type": "transcription_error",
                    "message": "Live transcription reached its session audio limit and has stopped.",
                }
            )
            return

        raw_snapshot = bytes(self._raw_bytes)
        try:
            waveform, duration = await asyncio.to_thread(extract_audio, raw_snapshot, sample_rate=SAMPLE_RATE)
        except AudioExtractionError as exc:
            await self._send({"type": "transcription_error", "message": f"Could not decode audio: {exc}"})
            return

        if duration - self._committed_until < _MIN_NEW_AUDIO_SECONDS:
            return

        window_start = max(0.0, self._committed_until - _OVERLAP_SECONDS)
        window = waveform[int(window_start * SAMPLE_RATE):]
        if window.size == 0:
            return

        segments = await self._worker.transcribe(window)

        for segment in segments:
            abs_start = window_start + segment.start
            abs_end = window_start + segment.end
            if abs_end <= self._committed_until + 1e-6:
                continue  # fully inside the overlap -- already emitted last cycle
            text = segment.text.strip()
            if not text:
                continue
            await self._send(
                {
                    "type": "transcript",
                    "sequence": self._next_sequence,
                    "start": round(abs_start, 2),
                    "end": round(abs_end, 2),
                    "text": text,
                }
            )
            self._next_sequence += 1
            self._committed_until = max(self._committed_until, abs_end)

    async def stop(self) -> None:
        """Stops accepting new audio, drains what's already queued (best
        effort, bounded), then terminates the worker process. Safe to call
        more than once and from any state (including before `start()`'s
        first `transcription_ready` has fired).
        """
        if self._closed:
            return
        self._closed = True

        if self._task is not None:
            await self._audio_queue.put(None)
            try:
                await asyncio.wait_for(self._task, timeout=_DRAIN_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                logger.warning("live-transcription drain timed out; cancelling")
                self._task.cancel()
            except Exception:
                logger.exception("live-transcription task ended with an error during stop")

        await self._worker.stop()
