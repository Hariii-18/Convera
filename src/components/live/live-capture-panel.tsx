"use client";

import * as React from "react";
import { AlertCircle, Loader2, Mic, MicOff, Radio, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBytes } from "@/components/meetings/format";
import { formatElapsed } from "@/components/processing/format";
import { extractErrorMessage } from "@/features/auth/error";
import type { CaptureErrorReason } from "@/features/live-meetings/audio-capture";
import { useAudioCapture } from "@/features/live-meetings/hooks/use-audio-capture";
import { useStartLiveMeeting } from "@/features/live-meetings/hooks/use-start-live-meeting";
import { useStopLiveMeeting } from "@/features/live-meetings/hooks/use-stop-live-meeting";
import { cn } from "@/lib/utils";

/** Set only from event handlers (Start/Stop clicks and their results) — never mirrored from other state via an effect. */
type SessionPhase = "idle" | "starting" | "stopping" | "stopped" | "error";
type DisplayPhase = "idle" | "starting" | "live" | "stopping" | "stopped" | "error";

const CAPTURE_ERROR_MESSAGES: Record<CaptureErrorReason, string> = {
  permission_denied:
    "Microphone access was denied. Allow microphone access in your browser settings and try again.",
  unsupported:
    "This browser doesn't support the audio recording APIs needed for a live meeting.",
  no_audio_track: "No microphone audio was detected on the selected device.",
  recorder_error: "The recorder stopped unexpectedly.",
  device_lost: "The microphone was disconnected or its access was revoked.",
};

const STATUS_CONFIG: Record<
  DisplayPhase,
  { label: string; status: "success" | "warning" | "error" | "info" | "neutral" }
> = {
  idle: { label: "Idle", status: "neutral" },
  starting: { label: "Starting…", status: "info" },
  live: { label: "Recording", status: "success" },
  stopping: { label: "Stopping…", status: "warning" },
  stopped: { label: "Stopped", status: "neutral" },
  error: { label: "Error", status: "error" },
};

/**
 * Minimum Live Meeting UI for Phase 3: proves the browser can start a
 * session, capture microphone audio in short chunks, and stop cleanly.
 * Chunks are queued locally only — Phase 4 owns sending them anywhere.
 */
function LiveCapturePanel() {
  const capture = useAudioCapture();
  const startMutation = useStartLiveMeeting();
  const stopMutation = useStopLiveMeeting();

  const [sessionPhase, setSessionPhase] = React.useState<SessionPhase>("idle");
  const [meetingId, setMeetingId] = React.useState<string | null>(null);
  const [mutationErrorMessage, setMutationErrorMessage] = React.useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const captureStartRef = React.useRef<number | null>(null);

  // The recorder actually reaching "capturing" (vs. still requesting
  // permission) and any capture-layer error are both already tracked as
  // state inside `capture` — derive the panel's displayed phase from that
  // plus our own session phase instead of mirroring it into more state.
  const phase: DisplayPhase =
    capture.error && sessionPhase !== "stopped"
      ? "error"
      : sessionPhase === "starting" && capture.state === "capturing"
        ? "live"
        : sessionPhase;

  const captureErrorMessage = capture.error
    ? (CAPTURE_ERROR_MESSAGES[capture.error.reason] ?? capture.error.message)
    : null;
  const errorMessage = captureErrorMessage ?? mutationErrorMessage;

  // Toast is an imperative call into an external system, not a React state
  // update, so this is a legitimate effect — it just reacts to the capture
  // layer's own error state rather than deriving new state from it.
  React.useEffect(() => {
    if (captureErrorMessage) toast.error(captureErrorMessage);
  }, [captureErrorMessage]);

  // Elapsed timer, ticking only while actually live.
  React.useEffect(() => {
    if (phase !== "live") return;
    if (captureStartRef.current === null) {
      captureStartRef.current = Date.now();
    }
    const interval = setInterval(() => {
      const start = captureStartRef.current ?? Date.now();
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // "error" stays retryable (e.g. permission denied -> user fixes it and
  // tries again) rather than leaving Start permanently disabled.
  const isStartDisabled = phase === "starting" || phase === "live" || phase === "stopping" || phase === "stopped";
  const canStop = phase === "live" || phase === "error";

  async function handleStart() {
    if (isStartDisabled) return; // guards a duplicate session/recorder from a double click

    setSessionPhase("starting");
    setMutationErrorMessage(null);
    setElapsedSeconds(0);
    captureStartRef.current = null;

    try {
      const session = await startMutation.mutateAsync(undefined);
      setMeetingId(session.meetingId);
    } catch (err) {
      const message = extractErrorMessage(err);
      setMutationErrorMessage(message);
      toast.error(message);
      setSessionPhase("error");
      return;
    }

    await capture.startCapture();
  }

  async function handleStop() {
    if (!meetingId || !canStop) return;

    setSessionPhase("stopping");
    await capture.stopCapture();

    try {
      await stopMutation.mutateAsync(meetingId);
      setSessionPhase("stopped");
      toast.success("Live meeting stopped");
    } catch (err) {
      const message = extractErrorMessage(err);
      setMutationErrorMessage(message);
      toast.error(message);
      setSessionPhase("error");
    }
  }

  const statusConfig = STATUS_CONFIG[phase];
  const isMicActive = phase === "live";
  const lastChunk = capture.chunks[capture.chunks.length - 1] ?? null;

  return (
    <Card data-slot="live-capture-panel">
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden="true"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                isMicActive
                  ? "bg-success/10 text-success"
                  : phase === "error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {isMicActive ? (
                <Mic className="size-4" />
              ) : phase === "error" ? (
                <MicOff className="size-4" />
              ) : (
                <Radio className="size-4" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {isMicActive ? "Microphone capturing" : "Live Meeting"}
              </span>
              <span className="text-xs text-muted-foreground">
                {capture.state === "requesting_permission"
                  ? "Waiting for microphone permission…"
                  : formatElapsed(elapsedSeconds)}
              </span>
            </div>
          </div>
          <StatusBadge status={statusConfig.status}>{statusConfig.label}</StatusBadge>
        </div>

        {phase === "error" && errorMessage && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs">{errorMessage}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={handleStart} disabled={isStartDisabled}>
            {phase === "starting" && <Loader2 className="animate-spin" data-icon="inline-start" />}
            Start Live Meeting
          </Button>
          <Button variant="outline" onClick={handleStop} disabled={!canStop}>
            {phase === "stopping" ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Square data-icon="inline-start" />
            )}
            Stop Meeting
          </Button>
        </div>

        {/* Phase 3 debug readout — chunking is only proven locally, nothing is uploaded yet. */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 px-3 py-2.5 text-xs sm:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Chunks</dt>
            <dd className="font-medium text-foreground">{capture.chunkCount}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Last chunk</dt>
            <dd className="font-medium text-foreground">
              {lastChunk ? formatBytes(lastChunk.blob.size) : "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Format</dt>
            <dd className="truncate font-medium text-foreground">{capture.mimeType ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Meeting ID</dt>
            <dd className="truncate font-mono font-medium text-foreground">
              {meetingId ?? "—"}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export { LiveCapturePanel };
