"""Speaker System Part 4: session-level speaker identity for Live Meetings.

`DiarizationProvider.diarize()` (`mfcc_diarizer.py`) is a one-shot batch op:
the cluster ids it produces are only meaningful within that one call, and get
remapped to `speaker_1`, `speaker_2`, ... by order of first appearance
*within that call* (`mfcc_diarizer._stable_speaker_keys`). Calling it
independently on each freshly-arrived live audio chunk would therefore hand
back a fresh `speaker_1` for whichever voice happens to speak first in *that*
chunk -- exactly the "new key for the same returning voice" failure this
phase must not produce.

`LiveDiarizationSession` keeps one growing, session-scoped state instead of
a fresh per-chunk clustering run:

- Every speech window's voice fingerprint (`features.embed_window`) is
  computed once and cached. `update()` only ever scans/embeds audio *past*
  what has already been embedded -- old audio is never re-run through
  VAD/MFCC, so cost per call is proportional to the new audio in this cycle,
  not the whole session so far.
- What *does* rerun on every call is the cheap part:
  `clustering.cluster_embeddings` over the whole cached embedding set --
  plain numpy/scipy linkage over already-computed vectors, not audio
  processing. This is what keeps identity global/session-level (one cluster
  set for the whole meeting so far, never an independent per-chunk
  clustering) without paying to re-embed the whole session's audio on every
  ~7s cycle.
- Cluster ids are then remapped to stable `speaker_key`s the same way the
  batch provider does: by order of first appearance in time
  (`mfcc_diarizer._stable_speaker_keys`, reused unchanged). Because the
  window cache only ever grows and clustering is deterministic, an earlier
  window's time-order position -- and therefore its remapped key -- stays
  stable across calls as long as the partition it belongs to stays stable,
  which is the same guarantee (and the same tuned distance threshold) the
  already-verified batch path relies on (`scripts.verify_diarization`).

This is an incremental *orchestration* layer over the exact same primitives
the batch provider uses (VAD via `faster_whisper.vad`, `features.embed_window`,
`clustering.cluster_embeddings`, and `mfcc_diarizer`'s own window-merge /
short-segment-prune / first-appearance-remap helpers) -- not a second
diarization implementation.
"""

from __future__ import annotations

import numpy as np
from faster_whisper.vad import VadOptions, get_speech_timestamps

from app.services.diarization.base import DiarizationSegment
from app.services.diarization.clustering import DEFAULT_DISTANCE_THRESHOLD, cluster_embeddings
from app.services.diarization.features import embed_window
from app.services.diarization.mfcc_diarizer import (
    _merge_windows,
    _prune_short_segments,
    _stable_speaker_keys,
    _sub_windows,
)

# Same VAD tuning as `MfccDiarizationProvider.diarize` -- see that module's
# docstring for why (quiet/slow speech shouldn't be clipped as silence).
_VAD_OPTIONS = VadOptions(threshold=0.35, min_speech_duration_ms=200, speech_pad_ms=200)


class LiveDiarizationSession:
    """One instance per live meeting WebSocket session, owned by
    `LiveTranscriptionPipeline` for that connection's lifetime.

    Not safe for concurrent `update()` calls -- mirrors
    `LiveTranscriptionWorker`'s single-window-in-flight assumption; the live
    pipeline only ever calls this from its own sequential per-chunk
    processing loop, one call at a time.
    """

    def __init__(self, *, distance_threshold: float = DEFAULT_DISTANCE_THRESHOLD) -> None:
        self.distance_threshold = distance_threshold
        self._windows: list[tuple[float, float]] = []
        self._embeddings: list[np.ndarray] = []
        self._embedded_until_s = 0.0

    def update(self, audio: np.ndarray, *, sample_rate: int) -> list[DiarizationSegment]:
        """`audio` is the full session waveform decoded so far -- the same
        cumulative buffer `LiveTranscriptionPipeline` already decodes every
        cycle for transcription (see that module's docstring on chunk
        framing). Only the portion past what this session has already
        embedded is scanned for speech and embedded; returns time-ordered,
        non-overlapping `DiarizationSegment`s for the *whole* session so far
        -- the same shape a batch `DiarizationProvider.diarize()` call would
        return, ready to feed straight into
        `speaker_alignment_service.align_transcript_segments`.

        Run this off the asyncio event loop (`asyncio.to_thread`) -- VAD and
        clustering are both CPU-bound, same reasoning as the transcription
        worker and `extract_audio`.
        """
        new_from_sample = int(round(self._embedded_until_s * sample_rate))
        new_audio = audio[new_from_sample:]

        if new_audio.size > 0:
            speech_chunks = get_speech_timestamps(new_audio, _VAD_OPTIONS, sampling_rate=sample_rate)
            for chunk in speech_chunks:
                chunk_start = self._embedded_until_s + chunk["start"] / sample_rate
                chunk_end = self._embedded_until_s + chunk["end"] / sample_rate
                for start, end in _sub_windows(chunk_start, chunk_end):
                    window_audio = audio[int(start * sample_rate) : int(end * sample_rate)]
                    embedding = embed_window(window_audio, sample_rate)
                    if embedding is None:
                        continue
                    self._windows.append((start, end))
                    self._embeddings.append(embedding)

        self._embedded_until_s = audio.shape[0] / sample_rate

        if not self._embeddings:
            return []

        cluster_ids = cluster_embeddings(
            np.stack(self._embeddings), distance_threshold=self.distance_threshold
        )
        speaker_keys = _stable_speaker_keys(cluster_ids, self._windows)
        return _prune_short_segments(_merge_windows(self._windows, speaker_keys))
