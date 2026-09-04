"use client";

import * as React from "react";

import {
  AudioCaptureController,
  type AudioChunkMeta,
  type CaptureError,
  type CaptureState,
} from "@/features/live-meetings/audio-capture";

/**
 * React-facing wrapper around `AudioCaptureController`. Owns one controller
 * instance for the component's lifetime and mirrors its state/chunks/error
 * into React state, plus releases the microphone on unmount so navigating
 * away always stops capture.
 *
 * `onChunkCaptured` (optional) is called synchronously, in production order,
 * the moment each chunk is emitted — this is how Phase 4's transport layer
 * subscribes without `AudioCaptureController` knowing anything about it. It
 * runs ahead of the `chunks` React state update, which is what a transport
 * needs to send chunks in order without waiting on a render.
 */
export function useAudioCapture(onChunkCaptured?: (chunk: AudioChunkMeta) => void) {
  const [controller] = React.useState(() => new AudioCaptureController());

  const [state, setState] = React.useState<CaptureState>("idle");
  const [chunks, setChunks] = React.useState<AudioChunkMeta[]>([]);
  const [error, setError] = React.useState<CaptureError | null>(null);

  const onChunkCapturedRef = React.useRef(onChunkCaptured);
  React.useEffect(() => {
    onChunkCapturedRef.current = onChunkCaptured;
  }, [onChunkCaptured]);

  React.useEffect(() => {
    const unsubState = controller.onStateChange(setState);
    const unsubChunk = controller.onChunk((chunk) => {
      setChunks((prev) => [...prev, chunk]);
      onChunkCapturedRef.current?.(chunk);
    });
    const unsubError = controller.onError((err) => setError(err));

    return () => {
      unsubState();
      unsubChunk();
      unsubError();
      controller.destroy();
    };
  }, [controller]);

  // Belt-and-suspenders for a hard page reload/close: SPA navigation is
  // covered by the unmount cleanup above, but a full reload skips React
  // teardown entirely, so release the microphone directly on unload too.
  React.useEffect(() => {
    function handleBeforeUnload() {
      controller.destroy();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [controller]);

  const startCapture = React.useCallback(async () => {
    setError(null);
    setChunks([]);
    await controller.startCapture();
  }, [controller]);

  const stopCapture = React.useCallback(async () => {
    return controller.stopCapture();
  }, [controller]);

  const pause = React.useCallback(() => {
    controller.pause();
  }, [controller]);

  const resume = React.useCallback(() => {
    controller.resume();
  }, [controller]);

  const cancelCapture = React.useCallback(() => {
    controller.cancelCapture();
    setChunks([]);
    setError(null);
  }, [controller]);

  const mimeType = chunks[0]?.mimeType ?? null;

  return {
    state,
    chunks,
    chunkCount: chunks.length,
    mimeType,
    error,
    startCapture,
    stopCapture,
    pause,
    resume,
    cancelCapture,
  };
}
