/**
 * Browser-side audio capture for a Live Meeting (Phase 3).
 *
 * Framework-agnostic: no React here. Wraps `getUserMedia` + `MediaRecorder`
 * behind a small pub/sub interface — `startCapture()` / `onChunk()` /
 * `stopCapture()` — so Phase 4's transport layer can subscribe to chunks
 * without touching this recorder at all. See `use-audio-capture.ts` for the
 * React-facing wrapper.
 *
 * Does NOT send chunks anywhere — they're handed to listeners and kept in
 * an in-memory queue (`getChunks()`) for Phase 4 to drain.
 */

export type CaptureState =
  | "idle"
  | "requesting_permission"
  | "capturing"
  | "stopping"
  | "error";

export type AudioChunkMeta = {
  /** Monotonically increasing from 0 for the lifetime of one capture session. */
  sequence: number;
  /** Elapsed ms since `startCapture()` resolved, at the moment this chunk was emitted. */
  timestampMs: number;
  blob: Blob;
  mimeType: string;
};

export type CaptureErrorReason =
  | "permission_denied"
  | "unsupported"
  | "no_audio_track"
  | "recorder_error"
  | "device_lost";

export class CaptureError extends Error {
  readonly reason: CaptureErrorReason;

  constructor(reason: CaptureErrorReason, message: string) {
    super(message);
    this.name = "CaptureError";
    this.reason = reason;
  }
}

type ChunkListener = (chunk: AudioChunkMeta) => void;
type StateListener = (state: CaptureState) => void;
type ErrorListener = (error: CaptureError) => void;
type Unsubscribe = () => void;

/** ~5-10s chunk cadence, per Phase 3 spec. */
const CHUNK_INTERVAL_MS = 7000;

/**
 * Ordered by preference: Opus-in-WebM is the most broadly supported
 * audio-only MediaRecorder output across Chromium/Firefox and decodes
 * cleanly through the backend's existing PyAV pipeline. MP4/AAC covers
 * Safari, which doesn't support WebM recording.
 */
const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export class AudioCaptureController {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private sequence = 0;
  private startTime = 0;
  private chunks: AudioChunkMeta[] = [];
  private state: CaptureState = "idle";

  private readonly chunkListeners = new Set<ChunkListener>();
  private readonly stateListeners = new Set<StateListener>();
  private readonly errorListeners = new Set<ErrorListener>();

  getState(): CaptureState {
    return this.state;
  }

  getChunks(): readonly AudioChunkMeta[] {
    return this.chunks;
  }

  onChunk(listener: ChunkListener): Unsubscribe {
    this.chunkListeners.add(listener);
    return () => this.chunkListeners.delete(listener);
  }

  onStateChange(listener: StateListener): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onError(listener: ErrorListener): Unsubscribe {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private setState(state: CaptureState) {
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  private emitError(reason: CaptureErrorReason, message: string) {
    console.error("[live-capture] error:", reason, message);
    this.releaseStream();
    this.setState("error");
    const error = new CaptureError(reason, message);
    this.errorListeners.forEach((listener) => listener(error));
  }

  /** No-op (rather than throwing) if capture is already starting/running — guards against duplicate recorder instances from a double click. */
  async startCapture(): Promise<void> {
    if (this.state === "requesting_permission" || this.state === "capturing") {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.emitError("unsupported", "This browser does not support microphone capture.");
      return;
    }

    const mimeType = pickSupportedMimeType();
    if (!mimeType) {
      this.emitError(
        "unsupported",
        "This browser does not support audio recording (MediaRecorder).",
      );
      return;
    }

    this.setState("requesting_permission");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.emitError("permission_denied", "Microphone permission was denied.");
      return;
    }

    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((track) => track.stop());
      this.emitError("no_audio_track", "No audio track was available from the microphone.");
      return;
    }

    this.stream = stream;
    this.sequence = 0;
    this.chunks = [];
    this.startTime = performance.now();

    stream.getAudioTracks().forEach((track) => {
      track.addEventListener("ended", () => this.handleTrackEnded());
    });

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      this.emitError("unsupported", `Recording with mime type "${mimeType}" failed to start.`);
      return;
    }
    this.recorder = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (!event.data || event.data.size === 0) return;
      const chunk: AudioChunkMeta = {
        sequence: this.sequence++,
        timestampMs: performance.now() - this.startTime,
        blob: event.data,
        mimeType: event.data.type || mimeType,
      };
      this.chunks.push(chunk);
      console.debug(
        `[live-capture] chunk #${chunk.sequence} — ${chunk.blob.size}B @ ${Math.round(chunk.timestampMs)}ms`,
      );
      this.chunkListeners.forEach((listener) => listener(chunk));
    };

    recorder.onerror = (event) => {
      const domError = (event as Event & { error?: DOMException }).error;
      this.emitError("recorder_error", domError?.message ?? "The recorder stopped unexpectedly.");
    };

    recorder.start(CHUNK_INTERVAL_MS);
    console.debug(`[live-capture] started — mimeType=${mimeType}`);
    this.setState("capturing");
  }

  private handleTrackEnded() {
    if (this.state === "capturing") {
      this.emitError("device_lost", "The microphone was disconnected or its access was revoked.");
    }
  }

  /** Stops the recorder, waits for the final `dataavailable` flush, then releases the microphone. Safe to call from any state. */
  async stopCapture(): Promise<void> {
    if (this.state === "idle") return;
    if (this.state === "stopping") return;

    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") {
      this.releaseStream();
      this.setState("idle");
      return;
    }

    this.setState("stopping");

    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    console.debug(`[live-capture] stopped — ${this.chunks.length} chunk(s) captured`);
    this.releaseStream();
    this.setState("idle");
  }

  private releaseStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.recorder) {
      this.recorder.ondataavailable = null;
      this.recorder.onerror = null;
    }
    this.recorder = null;
    this.stream = null;
  }

  /** Hard reset for unmount/navigation: releases the microphone immediately without waiting for a flush. */
  destroy() {
    this.releaseStream();
    this.state = "idle";
  }
}
