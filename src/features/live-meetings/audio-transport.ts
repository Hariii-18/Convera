/**
 * Browser -> FastAPI WebSocket transport for Live Meeting audio chunks
 * (Phase 4). Deliberately decoupled from `AudioCaptureController`: it only
 * knows about `AudioChunkMeta` objects handed to `sendChunk()`, the same way
 * Phase 3's own docstring describes ("Phase 4's transport layer can
 * subscribe to chunks without touching this recorder at all").
 *
 * Wire protocol (mirrors the backend docstring in
 * `app/api/v1/live_meetings.py`):
 *
 *   -> {"type": "start"}                                     once, first
 *   -> {"type": "chunk", sequence, timestampMs, mimeType}     text frame,
 *      immediately followed by one BINARY frame (the chunk's audio bytes)
 *   -> {"type": "stop"}                                       once, last
 *
 *   <- {"type": "ready"}
 *   <- {"type": "ack", sequence}
 *   <- {"type": "error", message}
 *   <- {"type": "stopping"}
 *   <- {"type": "transcription_ready"}                      Phase 5, once
 *   <- {"type": "transcript", sequence, start, end, text}    Phase 5, per segment
 *   <- {"type": "transcription_error", message}              Phase 5, transcription-specific
 *
 * Chunks are sent strictly in sequence order (one at a time, awaiting each
 * blob-to-arraybuffer conversion before starting the next) because the
 * backend enforces strict monotonic ordering and rejects anything else as a
 * protocol error.
 */

import { API_BASE_URL } from "@/lib/api-client";
import type { AudioChunkMeta } from "@/features/live-meetings/audio-capture";

export type TransportState =
  | "idle"
  | "connecting"
  | "open"
  | "ready"
  | "stopping"
  | "closed"
  | "error";

export type TransportErrorReason =
  | "socket_error"
  | "queue_overflow"
  | "server_error"
  | "closed_unexpectedly";

export class TransportError extends Error {
  readonly reason: TransportErrorReason;

  constructor(reason: TransportErrorReason, message: string) {
    super(message);
    this.name = "TransportError";
    this.reason = reason;
  }
}

export type TransportStats = {
  generated: number;
  sent: number;
  acknowledged: number;
  failed: number;
  queued: number;
  lastSentSequence: number | null;
  lastAckedSequence: number | null;
};

/** One Phase 5 live transcript segment, as sent by the server. */
export type TranscriptSegment = {
  sequence: number;
  start: number;
  end: number;
  text: string;
};

type AckListener = (sequence: number) => void;
type ErrorListener = (error: TransportError) => void;
type StateListener = (state: TransportState) => void;
type TranscriptListener = (segment: TranscriptSegment) => void;
type TranscriptionReadyListener = () => void;
type TranscriptionErrorListener = (message: string) => void;
type Unsubscribe = () => void;

/** Bounded outgoing queue — protects against unbounded memory growth if the socket stalls. */
const MAX_QUEUE_SIZE = 20;
/** Bounded wait for outstanding chunks to be sent/ACKed before a graceful `close()` gives up and closes anyway. */
const STOP_DRAIN_TIMEOUT_MS = 5000;
const DRAIN_POLL_INTERVAL_MS = 100;

function buildStreamUrl(meetingId: string, token: string): string {
  const httpBase = API_BASE_URL.replace(/\/+$/, "");
  const wsBase = httpBase.replace(/^http/, "ws");
  const params = new URLSearchParams({ token });
  return `${wsBase}/live-meetings/${meetingId}/stream?${params.toString()}`;
}

export class LiveAudioTransport {
  private socket: WebSocket | null = null;
  private state: TransportState = "idle";
  private readonly queue: AudioChunkMeta[] = [];
  private readonly pendingAcks = new Set<number>();
  private draining = false;

  private generatedCount = 0;
  private sentCount = 0;
  private ackedCount = 0;
  private failedCount = 0;
  private lastSentSequence: number | null = null;
  private lastAckedSequence: number | null = null;

  private readonly ackListeners = new Set<AckListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private readonly stateListeners = new Set<StateListener>();
  private readonly transcriptListeners = new Set<TranscriptListener>();
  private readonly transcriptionReadyListeners = new Set<TranscriptionReadyListener>();
  private readonly transcriptionErrorListeners = new Set<TranscriptionErrorListener>();

  getState(): TransportState {
    return this.state;
  }

  getStats(): TransportStats {
    return {
      generated: this.generatedCount,
      sent: this.sentCount,
      acknowledged: this.ackedCount,
      failed: this.failedCount,
      queued: this.queue.length,
      lastSentSequence: this.lastSentSequence,
      lastAckedSequence: this.lastAckedSequence,
    };
  }

  onAck(listener: AckListener): Unsubscribe {
    this.ackListeners.add(listener);
    return () => this.ackListeners.delete(listener);
  }

  onError(listener: ErrorListener): Unsubscribe {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onStateChange(listener: StateListener): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onTranscript(listener: TranscriptListener): Unsubscribe {
    this.transcriptListeners.add(listener);
    return () => this.transcriptListeners.delete(listener);
  }

  onTranscriptionReady(listener: TranscriptionReadyListener): Unsubscribe {
    this.transcriptionReadyListeners.add(listener);
    return () => this.transcriptionReadyListeners.delete(listener);
  }

  onTranscriptionError(listener: TranscriptionErrorListener): Unsubscribe {
    this.transcriptionErrorListeners.add(listener);
    return () => this.transcriptionErrorListeners.delete(listener);
  }

  /** Opens the socket, sends "start", and resolves once "ready" comes back. */
  connect(meetingId: string, token: string): Promise<void> {
    if (this.socket) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.setState("connecting");

      let socket: WebSocket;
      try {
        socket = new WebSocket(buildStreamUrl(meetingId, token));
      } catch {
        const error = new TransportError("socket_error", "Failed to open WebSocket.");
        this.emitError(error.reason, error.message);
        reject(error);
        return;
      }
      socket.binaryType = "arraybuffer";
      this.socket = socket;

      let settled = false;
      let reportedError = false;

      socket.onopen = () => {
        this.setState("open");
        socket.send(JSON.stringify({ type: "start" }));
      };

      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return; // server never sends binary
        let msg: {
          type?: string;
          sequence?: number;
          message?: string;
          start?: number;
          end?: number;
          text?: string;
        };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case "ready":
            this.setState("ready");
            if (!settled) {
              settled = true;
              resolve();
            }
            this.flushQueue();
            break;
          case "ack":
            if (typeof msg.sequence === "number") {
              this.pendingAcks.delete(msg.sequence);
              this.ackedCount++;
              this.lastAckedSequence = msg.sequence;
              this.ackListeners.forEach((listener) => listener(msg.sequence!));
            }
            break;
          case "error":
            this.emitError("server_error", msg.message ?? "The server rejected a message.");
            break;
          case "stopping":
            this.setState("stopping");
            break;
          case "transcription_ready":
            this.transcriptionReadyListeners.forEach((listener) => listener());
            break;
          case "transcript":
            if (
              typeof msg.sequence === "number" &&
              typeof msg.start === "number" &&
              typeof msg.end === "number" &&
              typeof msg.text === "string" &&
              msg.text.length > 0
            ) {
              const segment: TranscriptSegment = {
                sequence: msg.sequence,
                start: msg.start,
                end: msg.end,
                text: msg.text,
              };
              this.transcriptListeners.forEach((listener) => listener(segment));
            }
            break;
          case "transcription_error":
            this.transcriptionErrorListeners.forEach((listener) =>
              listener(msg.message ?? "Live transcription failed."),
            );
            break;
          default:
            break;
        }
      };

      socket.onerror = () => {
        reportedError = true;
        const error = new TransportError("socket_error", "WebSocket connection error.");
        this.emitError(error.reason, error.message);
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      socket.onclose = (event) => {
        this.socket = null;
        if (!settled) {
          settled = true;
          const error = new TransportError(
            "closed_unexpectedly",
            `Connection closed before it was ready (code ${event.code}).`,
          );
          this.emitError(error.reason, error.message);
          reject(error);
          this.setState("closed");
          return;
        }
        if (!reportedError && this.state !== "stopping" && this.state !== "error") {
          this.emitError(
            "closed_unexpectedly",
            `Connection closed unexpectedly (code ${event.code}).`,
          );
        }
        this.setState("closed");
      };
    });
  }

  /** Enqueues a chunk for sending. Bounded — surfaces a `queue_overflow` error instead of growing without limit. */
  sendChunk(chunk: AudioChunkMeta): void {
    this.generatedCount++;

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.failedCount++;
      this.emitError(
        "queue_overflow",
        `Transport queue exceeded ${MAX_QUEUE_SIZE} pending chunks; capture must stop.`,
      );
      return;
    }

    this.queue.push(chunk);
    this.flushQueue();
  }

  private flushQueue(): void {
    if (this.draining) return;
    this.draining = true;
    void this.drainLoop();
  }

  private async drainLoop(): Promise<void> {
    try {
      while (this.queue.length > 0) {
        const socket = this.socket;
        if (!socket || socket.readyState !== WebSocket.OPEN) break;
        if (this.state !== "ready" && this.state !== "stopping") break;

        const chunk = this.queue.shift()!;
        await this.sendOverWire(socket, chunk);
      }
    } finally {
      this.draining = false;
    }
  }

  private async sendOverWire(socket: WebSocket, chunk: AudioChunkMeta): Promise<void> {
    try {
      const buffer = await chunk.blob.arrayBuffer();
      socket.send(
        JSON.stringify({
          type: "chunk",
          sequence: chunk.sequence,
          timestampMs: chunk.timestampMs,
          mimeType: chunk.mimeType,
        }),
      );
      socket.send(buffer);
      this.sentCount++;
      this.lastSentSequence = chunk.sequence;
      this.pendingAcks.add(chunk.sequence);
    } catch {
      this.failedCount++;
      this.emitError("socket_error", `Failed to send chunk #${chunk.sequence}.`);
    }
  }

  /**
   * Graceful stop, per the Phase 4 stop order: wait (bounded) for queued
   * chunks to be sent and ACKed, send `{"type": "stop"}`, then close.
   * Safe to call from any state.
   */
  async close(): Promise<void> {
    const socket = this.socket;
    if (!socket) {
      this.setState("closed");
      return;
    }

    const deadline = Date.now() + STOP_DRAIN_TIMEOUT_MS;
    // `draining` covers a chunk that's mid-flight (already shifted off
    // `queue` but not yet in `pendingAcks` — it's still awaiting its blob's
    // arrayBuffer conversion inside `sendOverWire`). Without it, a chunk
    // emitted right as stop() is called can race this wait and get silently
    // dropped when the socket closes underneath the pending send.
    while (
      (this.queue.length > 0 || this.pendingAcks.size > 0 || this.draining) &&
      Date.now() < deadline &&
      socket.readyState === WebSocket.OPEN
    ) {
      await new Promise((resolve) => setTimeout(resolve, DRAIN_POLL_INTERVAL_MS));
    }

    if (socket.readyState === WebSocket.OPEN) {
      // Wait (bounded) for the server's own `{"type": "stopping"}` reply
      // before initiating the close handshake — closing immediately after
      // send() races the server's read of "stop" and tends to tear down
      // the connection as an abrupt 1006 instead of a clean 1000.
      const stoppingAck = new Promise<void>((resolve) => {
        const onMessage = (event: MessageEvent) => {
          if (typeof event.data !== "string") return;
          try {
            if (JSON.parse(event.data)?.type === "stopping") {
              socket.removeEventListener("message", onMessage);
              resolve();
            }
          } catch {
            // ignore malformed frames while waiting for the ack
          }
        };
        socket.addEventListener("message", onMessage);
        setTimeout(() => {
          socket.removeEventListener("message", onMessage);
          resolve();
        }, 1000);
      });

      try {
        socket.send(JSON.stringify({ type: "stop" }));
      } catch {
        // socket already going away; fall through to close
      }
      this.setState("stopping");
      await stoppingAck;
    }

    await new Promise<void>((resolve) => {
      if (socket.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      socket.addEventListener("close", () => resolve(), { once: true });
      try {
        socket.close(1000);
      } catch {
        resolve();
      }
      setTimeout(resolve, 1000);
    });

    this.socket = null;
    this.setState("closed");
  }

  private setState(state: TransportState) {
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  private emitError(reason: TransportErrorReason, message: string) {
    console.error("[live-transport] error:", reason, message);
    this.setState("error");
    const error = new TransportError(reason, message);
    this.errorListeners.forEach((listener) => listener(error));
  }
}
