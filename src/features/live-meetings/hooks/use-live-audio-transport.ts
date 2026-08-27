"use client";

import * as React from "react";

import {
  LiveAudioTransport,
  type TranscriptSegment,
  type TransportError,
  type TransportState,
  type TransportStats,
} from "@/features/live-meetings/audio-transport";
import type { AudioChunkMeta } from "@/features/live-meetings/audio-capture";

/**
 * React-facing wrapper around `LiveAudioTransport`, mirroring the shape of
 * `useAudioCapture`. Owns one transport instance for the component's
 * lifetime and closes it on unmount.
 */
export function useLiveAudioTransport() {
  const [transport] = React.useState(() => new LiveAudioTransport());

  const [state, setState] = React.useState<TransportState>("idle");
  const [error, setError] = React.useState<TransportError | null>(null);
  const [stats, setStats] = React.useState<TransportStats>(() => transport.getStats());
  const [transcriptionReady, setTranscriptionReady] = React.useState(false);
  const [transcripts, setTranscripts] = React.useState<TranscriptSegment[]>([]);
  const [transcriptionError, setTranscriptionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const refreshStats = () => setStats(transport.getStats());
    const unsubState = transport.onStateChange((next) => {
      setState(next);
      refreshStats();
      if (next === "connecting") {
        setTranscriptionReady(false);
        setTranscripts([]);
        setTranscriptionError(null);
      }
    });
    const unsubError = transport.onError(setError);
    const unsubAck = transport.onAck(refreshStats);
    const unsubTranscriptionReady = transport.onTranscriptionReady(() => setTranscriptionReady(true));
    const unsubTranscript = transport.onTranscript((segment) => {
      setTranscripts((prev) => [...prev, segment]);
    });
    const unsubTranscriptionError = transport.onTranscriptionError(setTranscriptionError);

    return () => {
      unsubState();
      unsubError();
      unsubAck();
      unsubTranscriptionReady();
      unsubTranscript();
      unsubTranscriptionError();
      void transport.close();
    };
  }, [transport]);

  // `sent`/`lastSentSequence` update asynchronously inside the transport
  // (after a chunk's blob finishes converting to an ArrayBuffer), so a
  // light poll while a session is active keeps the debug readout honest
  // without adding another pub/sub channel to the transport's interface.
  React.useEffect(() => {
    if (state !== "open" && state !== "ready" && state !== "stopping") return;
    const interval = setInterval(() => setStats(transport.getStats()), 250);
    return () => clearInterval(interval);
  }, [state, transport]);

  const connect = React.useCallback(
    async (meetingId: string, token: string) => {
      setError(null);
      await transport.connect(meetingId, token);
    },
    [transport],
  );

  const sendChunk = React.useCallback(
    (chunk: AudioChunkMeta) => {
      transport.sendChunk(chunk);
      setStats(transport.getStats());
    },
    [transport],
  );

  const close = React.useCallback(() => transport.close(), [transport]);

  return {
    state,
    error,
    stats,
    connect,
    sendChunk,
    close,
    transcriptionReady,
    transcripts,
    transcriptionError,
  };
}
