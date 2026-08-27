"""Phase 4: WebSocket audio transport for a live meeting session.

Owns the wire-protocol bookkeeping for `WS /live-meetings/{meeting_id}/stream`
(see `app.api.v1.live_meetings`) — chunk ordering/dedup and a small bounded
in-memory buffer of recently accepted audio chunks. This module does no I/O
(no websocket, no DB); the route handler drives it and sends the actual
protocol messages.

Phase 5 (transcription) is expected to read chunks off `LiveAudioBuffer`.
Phase 4 does not decode, persist, or otherwise interpret the audio bytes —
it only validates and holds them.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

# Formats Phase 3's MediaRecorder can produce, all of which decode through
# the existing PyAV-based `transcription.audio.extract_audio` pipeline.
ALLOWED_MIME_TYPES = frozenset(
    {
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
    }
)

# Bounds the in-memory chunk buffer to roughly the last ~7.5 minutes of audio
# at Phase 3's ~7s chunk cadence, so a long-running session can't grow this
# without bound before Phase 5 exists to drain it. Scoped to one WebSocket
# connection's lifetime — nothing here is persisted.
MAX_BUFFERED_CHUNKS = 64

ChunkOutcomeKind = Literal[
    "accepted",
    "duplicate",
    "out_of_order",
    "invalid_sequence",
    "unsupported_mime",
]


@dataclass(frozen=True)
class AudioChunk:
    sequence: int
    timestamp_ms: float
    mime_type: str
    data: bytes


@dataclass(frozen=True)
class ChunkOutcome:
    kind: ChunkOutcomeKind
    detail: str | None = None


@dataclass
class LiveAudioBuffer:
    """Bounded, sequence-ordered chunk buffer for one WebSocket connection.

    Enforces strict monotonic ordering: only the next expected sequence is
    ever accepted. A sequence already accepted is a safe no-op duplicate
    (re-acknowledged, not reprocessed); anything else out of order is
    rejected with an explicit error rather than silently reordered — the
    client is expected to send in order (a single WebSocket connection
    delivers frames in order), so this only fires on a real protocol
    violation.
    """

    chunks: list[AudioChunk] = field(default_factory=list)
    accepted_sequences: set[int] = field(default_factory=set)
    next_expected_sequence: int = 0

    def classify(self, sequence: int, mime_type: object) -> ChunkOutcome:
        if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 0:
            return ChunkOutcome("invalid_sequence", "sequence must be a non-negative integer")

        if mime_type not in ALLOWED_MIME_TYPES:
            return ChunkOutcome("unsupported_mime", f"unsupported mimeType {mime_type!r}")

        if sequence == self.next_expected_sequence:
            return ChunkOutcome("accepted")

        if sequence in self.accepted_sequences or sequence < self.next_expected_sequence:
            return ChunkOutcome("duplicate")

        return ChunkOutcome(
            "out_of_order",
            f"expected sequence {self.next_expected_sequence}, got {sequence}",
        )

    def accept(self, chunk: AudioChunk) -> None:
        self.chunks.append(chunk)
        self.accepted_sequences.add(chunk.sequence)
        self.next_expected_sequence = chunk.sequence + 1
        if len(self.chunks) > MAX_BUFFERED_CHUNKS:
            evicted = self.chunks.pop(0)
            self.accepted_sequences.discard(evicted.sequence)
