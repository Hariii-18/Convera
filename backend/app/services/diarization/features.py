"""Voice fingerprint for a short audio window: MFCC statistics plus pitch.

No neural speaker-embedding model is used here (see the module docstring in
`mfcc_diarizer.py` for why) -- this is plain signal processing: framed
log-mel energies reduced with a DCT (the front end of a classic ASR/speaker
system), plus a pitch (F0) estimate from autocorrelation. Everything is
numpy; nothing here needs a model file or a download.

Pitch pulls its own weight here: on real speech it's one of the more
speaker-identifying, phonetic-content-*independent* cues a
non-neural pipeline can get cheaply, which matters because a short (a few
seconds) utterance doesn't give plain MFCC statistics enough phonetic
variety to average out into a stable, content-independent voice signature
(measured empirically while tuning this pipeline -- MFCC-mean/std alone did
not reliably separate short per-speaker turns; adding pitch did). It's also
the one dimension `clustering.py` deliberately does *not* z-score away --
see that module's docstring.
"""

from __future__ import annotations

import numpy as np

_N_MELS = 26
_N_MFCC = 13  # coefficients 1..13 (c0/log-energy is dropped -- see below)
_FRAME_MS = 25.0
_HOP_MS = 10.0
_FMIN_HZ = 80.0

# Autocorrelation pitch tracker: wider, hop-heavier frames than the MFCC
# front end above -- pitch periods need at least ~2-3 cycles of the lowest
# frequency in view (40ms captures down to ~50Hz with margin) and don't
# benefit from a 10ms hop the way spectral-envelope features do.
_F0_FRAME_MS = 40.0
_F0_HOP_MS = 20.0
_F0_MIN_HZ = 70.0
_F0_MAX_HZ = 350.0
# Normalized autocorrelation peak (peak / zero-lag energy) below this is
# treated as unvoiced/noise rather than a real pitch period.
_F0_VOICING_THRESHOLD = 0.3
_F0_MIN_VOICED_FRAMES = 3


def _hz_to_mel(hz: np.ndarray | float) -> np.ndarray | float:
    return 2595.0 * np.log10(1.0 + np.asarray(hz) / 700.0)


def _mel_to_hz(mel: np.ndarray | float) -> np.ndarray | float:
    return 700.0 * (10.0 ** (np.asarray(mel) / 2595.0) - 1.0)


def _mel_filterbank(n_fft: int, sample_rate: int) -> np.ndarray:
    """Triangular mel filterbank, shape `(_N_MELS, n_fft // 2 + 1)`."""
    fmax = sample_rate / 2.0
    mel_points = np.linspace(_hz_to_mel(_FMIN_HZ), _hz_to_mel(fmax), _N_MELS + 2)
    hz_points = _mel_to_hz(mel_points)
    bins = np.floor((n_fft + 1) * hz_points / sample_rate).astype(int)
    bins = np.clip(bins, 0, n_fft // 2)

    fbank = np.zeros((_N_MELS, n_fft // 2 + 1), dtype=np.float64)
    for i in range(1, _N_MELS + 1):
        left, center, right = bins[i - 1], bins[i], bins[i + 1]
        if center > left:
            fbank[i - 1, left:center] = (np.arange(left, center) - left) / (center - left)
        if right > center:
            fbank[i - 1, center:right] = (right - np.arange(center, right)) / (right - center)
    return fbank


def _dct_matrix(n_in: int, n_out: int) -> np.ndarray:
    """Orthonormal-ish DCT-II basis, shape `(n_out, n_in)`, used to compress
    `n_in` mel-log-energies down to `n_out` cepstral coefficients."""
    n = np.arange(n_in)
    k = np.arange(1, n_out + 1).reshape(-1, 1)  # skip k=0 (log-energy/loudness)
    return np.cos(np.pi / n_in * (n + 0.5) * k)


# Filterbank/DCT depend only on (n_fft, sample_rate), which are constant for
# a given `sample_rate` (fixed frame length below) -- build once per process.
_fbank_cache: dict[tuple[int, int], np.ndarray] = {}
_dct_cache: np.ndarray | None = None


def _get_filterbank(n_fft: int, sample_rate: int) -> np.ndarray:
    key = (n_fft, sample_rate)
    if key not in _fbank_cache:
        _fbank_cache[key] = _mel_filterbank(n_fft, sample_rate)
    return _fbank_cache[key]


def _get_dct() -> np.ndarray:
    global _dct_cache
    if _dct_cache is None:
        _dct_cache = _dct_matrix(_N_MELS, _N_MFCC)
    return _dct_cache


def compute_mfcc(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Frames `audio` (mono float32, [-1, 1]) into 25ms/10ms-hop windows and
    returns MFCCs, shape `(n_frames, _N_MFCC)`. `n_frames` is 0 for audio
    shorter than one frame.
    """
    frame_len = int(round(sample_rate * _FRAME_MS / 1000.0))
    hop_len = int(round(sample_rate * _HOP_MS / 1000.0))
    if audio.shape[0] < frame_len:
        return np.zeros((0, _N_MFCC), dtype=np.float64)

    n_frames = 1 + (audio.shape[0] - frame_len) // hop_len
    idx = np.arange(frame_len)[None, :] + hop_len * np.arange(n_frames)[:, None]
    frames = audio[idx].astype(np.float64)
    frames *= np.hamming(frame_len)

    n_fft = 1
    while n_fft < frame_len:
        n_fft *= 2
    spectrum = np.fft.rfft(frames, n=n_fft, axis=1)
    power = (spectrum.real**2 + spectrum.imag**2) / n_fft

    fbank = _get_filterbank(n_fft, sample_rate)
    mel_energy = power @ fbank.T
    log_mel = np.log(np.maximum(mel_energy, 1e-10))

    return log_mel @ _get_dct().T


def _estimate_pitch_track(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Per-frame F0 estimate (Hz) via normalized autocorrelation, one value
    per voiced frame (unvoiced/silent frames contribute nothing)."""
    frame_len = int(round(sample_rate * _F0_FRAME_MS / 1000.0))
    hop_len = int(round(sample_rate * _F0_HOP_MS / 1000.0))
    if audio.shape[0] < frame_len:
        return np.zeros((0,), dtype=np.float64)

    lag_min = int(sample_rate / _F0_MAX_HZ)
    lag_max = int(sample_rate / _F0_MIN_HZ)
    n_frames = 1 + (audio.shape[0] - frame_len) // hop_len

    f0s: list[float] = []
    for i in range(n_frames):
        frame = audio[i * hop_len : i * hop_len + frame_len].astype(np.float64)
        frame = frame - frame.mean()
        if np.max(np.abs(frame)) < 1e-4:  # near-silent frame, no pitch to find
            continue
        frame = frame * np.hamming(frame_len)
        autocorr = np.correlate(frame, frame, mode="full")[frame_len - 1 :]
        if autocorr[0] <= 0 or lag_max >= autocorr.shape[0]:
            continue
        candidates = autocorr[lag_min:lag_max]
        if candidates.size == 0:
            continue
        peak_lag = lag_min + int(np.argmax(candidates))
        if autocorr[peak_lag] / autocorr[0] > _F0_VOICING_THRESHOLD:
            f0s.append(sample_rate / peak_lag)
    return np.array(f0s, dtype=np.float64)


def _median_pitch(audio: np.ndarray, sample_rate: int) -> float:
    """Median F0 (Hz) across voiced frames, or `nan` when too few of the
    window's frames were voiced to trust a pitch estimate -- the caller
    (`clustering.cluster_embeddings`) imputes `nan`s from the rest of the
    recording rather than letting one noisy window skew its own value."""
    f0_track = _estimate_pitch_track(audio, sample_rate)
    if f0_track.shape[0] < _F0_MIN_VOICED_FRAMES:
        return float("nan")
    return float(np.median(f0_track))


def embed_window(audio: np.ndarray, sample_rate: int) -> np.ndarray | None:
    """Fixed-length voice fingerprint for one audio window: mean and std of
    each MFCC coefficient across frames, plus median pitch, shape
    `(2 * _N_MFCC + 1,)` -- the last element is raw Hz (`nan` if
    undetermined), deliberately *not* on the same normalized scale as the
    MFCC statistics; see `clustering.py`. `None` when the window is too
    short to yield any MFCC frames.
    """
    mfcc = compute_mfcc(audio, sample_rate)
    if mfcc.shape[0] == 0:
        return None
    pitch = _median_pitch(audio, sample_rate)
    return np.concatenate([mfcc.mean(axis=0), mfcc.std(axis=0), [pitch]])
