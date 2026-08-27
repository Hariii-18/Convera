"""CPU-only speaker diarization: MFCC + pitch voice fingerprints with
agglomerative clustering, with speech regions found by the Silero VAD model
faster-whisper already bundles.

Why this approach: the target environment has no GPU, tight RAM, and no
`torch` installed. The accurate off-the-shelf options (pyannote.audio,
wespeaker, speechbrain) are all neural speaker-embedding models that need
`torch`/`torchaudio` -- a multi-hundred-MB dependency this environment can't
comfortably absorb, and in pyannote's case a gated model requiring a
HuggingFace access token this deployment doesn't have configured. Silero VAD
is already a zero-cost dependency here: `faster_whisper` bundles it (via
`onnxruntime`, already installed for exactly this) and the transcription
step already runs it. Everything downstream of VAD (`features.py`,
`clustering.py`) is plain numpy/scipy signal processing -- no model
download, no torch, deterministic, and fast enough on 2 CPUs.

Tradeoff, stated plainly: this fingerprint (MFCC statistics + median pitch,
see `features.py`) is a coarser signal than a trained neural speaker
embedding. It works well when speakers have distinguishably different
voices -- pitch in particular, which is what made short (a few-second) turns
separable at all during tuning -- and struggles more than pyannote/wespeaker
would on two similar-pitched speakers or very short interjections. See the
module docstring in `factory.py` for the upgrade path once a `torch` budget
is acceptable in this environment.
"""

from __future__ import annotations

import logging

import numpy as np
from faster_whisper.vad import VadOptions, get_speech_timestamps

from app.services.diarization.base import DiarizationProvider, DiarizationSegment
from app.services.diarization.clustering import DEFAULT_DISTANCE_THRESHOLD, cluster_embeddings
from app.services.diarization.features import embed_window

logger = logging.getLogger("converra")

# Sub-segmentation window: short enough to isolate a single speaker's voice
# even when turns are close together, long enough to give `compute_mfcc` a
# stable estimate (a handful of 25ms frames per window at minimum).
_WINDOW_S = 1.5
_HOP_S = 0.75
# Consecutive same-speaker sub-windows within this gap are merged into one
# output segment (closes the small gaps `_HOP_S` overlap otherwise leaves).
_MERGE_GAP_S = 0.5
# A segment shorter than this is almost always a clustering blip at a
# boundary between two longer, real segments (one sub-window landing in a
# neighboring cluster) rather than a genuine sub-second speaker turn -- it's
# absorbed into its predecessor instead of standing as its own speaker.
_MIN_SEGMENT_S = 1.0


class MfccDiarizationProvider(DiarizationProvider):
    def __init__(self, *, distance_threshold: float = DEFAULT_DISTANCE_THRESHOLD) -> None:
        self.distance_threshold = distance_threshold

    def diarize(self, audio: np.ndarray, *, sample_rate: int = 16000) -> list[DiarizationSegment]:
        speech_chunks = get_speech_timestamps(
            audio,
            VadOptions(threshold=0.35, min_speech_duration_ms=200, speech_pad_ms=200),
            sampling_rate=sample_rate,
        )
        if not speech_chunks:
            return []

        windows: list[tuple[float, float]] = []
        for chunk in speech_chunks:
            windows.extend(
                _sub_windows(chunk["start"] / sample_rate, chunk["end"] / sample_rate)
            )
        if not windows:
            return []

        embeddings: list[np.ndarray] = []
        kept_windows: list[tuple[float, float]] = []
        for start, end in windows:
            window_audio = audio[int(start * sample_rate) : int(end * sample_rate)]
            embedding = embed_window(window_audio, sample_rate)
            if embedding is None:
                continue
            embeddings.append(embedding)
            kept_windows.append((start, end))

        if not kept_windows:
            return []

        cluster_ids = cluster_embeddings(
            np.stack(embeddings), distance_threshold=self.distance_threshold
        )
        speaker_keys = _stable_speaker_keys(cluster_ids, kept_windows)

        segments = _prune_short_segments(_merge_windows(kept_windows, speaker_keys))
        logger.info(
            "[diarization] %d speech windows -> %d segments, %d speaker(s)",
            len(kept_windows),
            len(segments),
            len({s.speaker_key for s in segments}),
        )
        return segments


def _sub_windows(chunk_start: float, chunk_end: float) -> list[tuple[float, float]]:
    duration = chunk_end - chunk_start
    if duration <= _WINDOW_S:
        return [(chunk_start, chunk_end)]

    windows: list[tuple[float, float]] = []
    pos = chunk_start
    while pos < chunk_end:
        end = min(pos + _WINDOW_S, chunk_end)
        windows.append((pos, end))
        if end >= chunk_end:
            break
        pos += _HOP_S
    return windows


def _stable_speaker_keys(
    cluster_ids: np.ndarray, windows: list[tuple[float, float]]
) -> list[str]:
    """Maps arbitrary cluster ids to `speaker_1`, `speaker_2`, ... in order
    of first appearance in time, so the label a speaker gets doesn't depend
    on clustering internals -- just on who spoke first."""
    first_seen: dict[int, float] = {}
    for cluster_id, (start, _end) in zip(cluster_ids, windows):
        cid = int(cluster_id)
        if cid not in first_seen or start < first_seen[cid]:
            first_seen[cid] = start

    ordered_ids = sorted(first_seen, key=lambda cid: first_seen[cid])
    key_by_cluster = {cid: f"speaker_{i + 1}" for i, cid in enumerate(ordered_ids)}
    return [key_by_cluster[int(cid)] for cid in cluster_ids]


def _merge_windows(
    windows: list[tuple[float, float]], speaker_keys: list[str]
) -> list[DiarizationSegment]:
    """Collapses consecutive same-speaker sub-windows into one segment.
    Consecutive sub-windows overlap by `_WINDOW_S - _HOP_S` by construction
    (see `_sub_windows`) -- when a speaker change lands inside that overlap,
    the shared span is split at its midpoint so output segments never
    overlap (requirement: ordered, non-overlapping output).
    """
    segments: list[DiarizationSegment] = []
    for start, end, speaker_key in zip(
        (w[0] for w in windows), (w[1] for w in windows), speaker_keys
    ):
        if segments and segments[-1].speaker_key == speaker_key:
            if start - segments[-1].end <= _MERGE_GAP_S:
                segments[-1].end = max(segments[-1].end, end)
                continue
        elif segments and start < segments[-1].end:
            boundary = (segments[-1].end + start) / 2
            segments[-1].end = boundary
            start = boundary
            if start >= end:
                continue  # this window's non-overlapping remainder is empty
        segments.append(DiarizationSegment(start=start, end=end, speaker_key=speaker_key))
    return segments


def _prune_short_segments(segments: list[DiarizationSegment]) -> list[DiarizationSegment]:
    if not segments:
        return segments

    pruned: list[DiarizationSegment] = [segments[0]]
    for seg in segments[1:]:
        if seg.end - seg.start < _MIN_SEGMENT_S:
            pruned[-1].end = seg.end  # absorb into predecessor, keep its speaker_key
        else:
            pruned.append(seg)

    # A same-speaker run can end up split across the merge above (e.g. A, a
    # blip absorbed into A, then another A window that never got merged
    # because the blip was appended separately below) -- collapse any
    # resulting adjacent same-speaker pairs left behind by pruning.
    collapsed: list[DiarizationSegment] = [pruned[0]]
    for seg in pruned[1:]:
        if collapsed[-1].speaker_key == seg.speaker_key:
            collapsed[-1].end = seg.end
        else:
            collapsed.append(seg)
    return collapsed
