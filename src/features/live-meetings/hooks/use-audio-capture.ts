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
 */
export function useAudioCapture() {
  const [controller] = React.useState(() => new AudioCaptureController());

  const [state, setState] = React.useState<CaptureState>("idle");
  const [chunks, setChunks] = React.useState<AudioChunkMeta[]>([]);
  const [error, setError] = React.useState<CaptureError | null>(null);

  React.useEffect(() => {
    const unsubState = controller.onStateChange(setState);
    const unsubChunk = controller.onChunk((chunk) => {
      setChunks((prev) => [...prev, chunk]);
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
    await controller.stopCapture();
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
  };
}
