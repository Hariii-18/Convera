"""Decodes the audio track out of any supported upload (audio or video).

Uses PyAV, which bundles its own FFmpeg libraries, so this works the same on
every machine without a system `ffmpeg` install. Video containers (mp4, mov,
mkv, webm) are handled the same way as audio-only files — only the audio
stream is decoded, so the "extract audio from video" step and the "decode an
audio file" step are the same code path.
"""

from __future__ import annotations

import io
import logging
import time

import av
import numpy as np

logger = logging.getLogger("converra")


class AudioExtractionError(Exception):
    """Raised when no usable audio track can be decoded from a media file."""


def extract_audio(file_bytes: bytes, *, sample_rate: int = 16000) -> tuple[np.ndarray, float]:
    """Returns (mono float32 waveform in [-1, 1], duration_seconds)."""
    logger.info("[timing] extract_audio start")
    t0 = time.perf_counter()
    try:
        container = av.open(io.BytesIO(file_bytes))
    except Exception as exc:  # noqa: BLE001 (PyAV raises assorted decode errors)
        raise AudioExtractionError(f"Could not open media file: {exc}") from exc

    try:
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            raise AudioExtractionError("No audio track found in the uploaded file")

        resampler = av.AudioResampler(format="s16", layout="mono", rate=sample_rate)
        chunks: list[np.ndarray] = []
        frame_count = 0

        try:
            for frame in container.decode(stream):
                frame_count += 1
                for resampled in resampler.resample(frame):
                    chunks.append(resampled.to_ndarray())
        except Exception as exc:  # noqa: BLE001 (corrupt/truncated media)
            raise AudioExtractionError(f"Failed to decode audio: {exc}") from exc

        if not chunks:
            raise AudioExtractionError("No audio samples could be decoded")

        samples = np.concatenate(chunks, axis=1).flatten().astype(np.float32) / 32768.0
        duration = samples.shape[0] / sample_rate
        logger.info(
            "[timing] extract_audio end elapsed=%.3fs frames=%d total_samples=%d duration=%.3fs",
            time.perf_counter() - t0, frame_count, samples.shape[0], duration,
        )
        return samples, duration
    finally:
        container.close()
