"""Groups per-window voice fingerprints (`features.embed_window`) into
speaker clusters.

Average-linkage agglomerative clustering, cut at a fixed distance threshold
rather than a fixed cluster count -- this is what lets the pipeline support
an arbitrary, unknown-in-advance number of speakers instead of having to be
told how many voices are in the recording.

Distance metric: Euclidean, over a feature space built as
`[z-scored MFCC mean/std..., raw pitch in Hz]`. The MFCC block is z-scored
per-recording (mean/std computed across this recording's own windows, not a
fixed constant) so its ~26 dimensions sit on a comparable scale to each
other. Pitch is deliberately left in raw Hz rather than folded into that
same z-scoring: cosine distance (tried first) turned out unable to separate
speakers by pitch at all -- it's scale-invariant, so it only sees which
*sign* of the mean a value falls on, not how far from it -- and naively
z-scoring pitch into the same space as z-scored MFCC dimensions let 26 noisy
MFCC dimensions outvote the one dimension doing most of the actual
separating (both found empirically while tuning this pipeline against
synthesized multi-voice audio -- see `scripts.verify_diarization`). Euclidean
distance with pitch left in its natural Hz scale is what let a
several-seconds-long, phonetically varied turn still cluster correctly.

Runs over the whole recording's embeddings at once (not chunk-by-chunk), so
there's no notion of a "current chunk's speaker 1" that could collide with
an earlier chunk's -- cluster identity is global by construction. It's also
a deterministic, non-randomized algorithm (no seed, no initialization
sensitivity), so the same embeddings always produce the same clustering.
"""

from __future__ import annotations

import numpy as np
from scipy.cluster.hierarchy import fcluster, linkage

# Euclidean-distance cutoff for merging two clusters, in the mixed
# [z-scored MFCC, raw-Hz pitch] space `_normalize` builds -- tuned so a
# same-speaker MFCC/pitch drift stays under threshold while a genuine
# ~15Hz+ median-pitch gap between speakers (typical even within the same
# gender) does not. Lower = more, smaller clusters; higher = fewer, larger.
DEFAULT_DISTANCE_THRESHOLD = 18.0

# Fallback median pitch (Hz) when a recording has no voiced windows at all
# to compute one from -- keeps clustering well-defined instead of raising.
_DEFAULT_PITCH_HZ = 150.0


def _normalize(embeddings: np.ndarray) -> np.ndarray:
    mfcc_block = embeddings[:, :-1]
    pitch = embeddings[:, -1]

    mean = mfcc_block.mean(axis=0)
    std = mfcc_block.std(axis=0)
    std[std == 0] = 1.0
    mfcc_z = (mfcc_block - mean) / std

    voiced = ~np.isnan(pitch)
    fallback = float(np.median(pitch[voiced])) if voiced.any() else _DEFAULT_PITCH_HZ
    pitch_filled = np.where(voiced, pitch, fallback)

    return np.concatenate([mfcc_z, pitch_filled[:, None]], axis=1)


def cluster_embeddings(
    embeddings: np.ndarray, *, distance_threshold: float = DEFAULT_DISTANCE_THRESHOLD
) -> np.ndarray:
    """Returns a 0-indexed cluster id per row of `embeddings` (shape `(n,)`,
    each row `[mfcc_mean..., mfcc_std..., pitch_hz]` from `embed_window`).
    Cluster ids are arbitrary/unordered here -- the caller
    (`mfcc_diarizer.diarize`) remaps them to `speaker_N` by first
    appearance.
    """
    n = embeddings.shape[0]
    if n == 0:
        return np.zeros((0,), dtype=int)
    if n == 1:
        return np.zeros((1,), dtype=int)

    features = _normalize(embeddings)
    z = linkage(features, method="average", metric="euclidean")
    labels = fcluster(z, t=distance_threshold, criterion="distance")
    return labels - 1  # fcluster is 1-indexed
