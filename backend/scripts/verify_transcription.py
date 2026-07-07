"""Verify the transcription pipeline can decode audio and run a real model.

Synthesizes a short WAV clip in-memory (no fixture file needed), runs it
through the same `extract_audio` -> provider `transcribe` path the processing
worker uses, and prints the result. A silent/tone clip won't produce
meaningful words, but this confirms PyAV decoding, model loading, and the
faster-whisper provider all work end-to-end.

Usage: python -m scripts.verify_transcription
"""

import io
import struct
import sys
import wave

from app.services.transcription.audio import extract_audio
from app.services.transcription.factory import get_transcription_provider


def _make_test_wav_bytes(*, seconds: float = 2.0, sample_rate: int = 16000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        frame_count = int(seconds * sample_rate)
        # Low-amplitude silence is enough to exercise decode + inference.
        wav_file.writeframes(struct.pack(f"<{frame_count}h", *([0] * frame_count)))
    return buffer.getvalue()


def main() -> int:
    print("Synthesizing test audio...")
    test_audio = _make_test_wav_bytes()

    try:
        waveform, duration = extract_audio(test_audio)
    except Exception as exc:  # noqa: BLE001 (top-level diagnostic script)
        print(f"FAILED: audio extraction failed: {exc}")
        return 1
    print(f"OK: extracted {waveform.shape[0]} samples ({duration:.2f}s)")

    try:
        provider = get_transcription_provider()
        result = provider.transcribe(waveform)
    except Exception as exc:  # noqa: BLE001 (top-level diagnostic script)
        print(f"FAILED: transcription failed: {exc}")
        return 1

    print(f"OK: transcribed via provider (language={result.language}, duration={result.duration:.2f}s)")
    print(f"    text: {result.text!r}")
    print(f"    segments: {len(result.segments)}, word_count: {result.word_count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
