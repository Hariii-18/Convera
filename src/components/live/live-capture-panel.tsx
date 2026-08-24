"use client";

import * as React from "react";
import { AlertCircle, Loader2, Mic, MicOff, Radio, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { MeetingTitleInput } from "@/components/meetings/meeting-title-input";
import { formatBytes } from "@/components/meetings/format";
import { formatElapsed } from "@/components/processing/format";
import { extractErrorMessage } from "@/features/auth/error";
import type { CaptureErrorReason } from "@/features/live-meetings/audio-capture";
import { useAudioCapture } from "@/features/live-meetings/hooks/use-audio-capture";
import { useLiveAudioTransport } from "@/features/live-meetings/hooks/use-live-audio-transport";
import { useStartLiveMeeting } from "@/features/live-meetings/hooks/use-start-live-meeting";
import { useStopLiveMeeting } from "@/features/live-meetings/hooks/use-stop-live-meeting";
import { getAccessTokenCookie } from "@/lib/cookies";
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
  const liveTransport = useLiveAudioTransport();
  const capture = useAudioCapture((chunk) => liveTransport.sendChunk(chunk));
  const startMutation = useStartLiveMeeting();
  const stopMutation = useStopLiveMeeting();

  const [sessionPhase, setSessionPhase] = React.useState<SessionPhase>("idle");
  const [meetingId, setMeetingId] = React.useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [titleError, setTitleError] = React.useState<string | null>(null);
  const [mutationErrorMessage, setMutationErrorMessage] = React.useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const captureStartRef = React.useRef<number | null>(null);

  // The recorder actually reaching "capturing" (vs. still requesting
  // permission) and any capture-layer error are both already tracked as
  // state inside `capture` — derive the panel's displayed phase from that
  // plus our own session phase instead of mirroring it into more state.
  const phase: DisplayPhase =
    (capture.error || liveTransport.error) && sessionPhase !== "stopped"
      ? "error"
      : sessionPhase === "starting" && capture.state === "capturing"
        ? "live"
        : sessionPhase;

  const captureErrorMessage = capture.error
    ? (CAPTURE_ERROR_MESSAGES[capture.error.reason] ?? capture.error.message)
    : null;
  const transportErrorMessage = liveTransport.error?.message ?? null;
  const errorMessage = captureErrorMessage ?? transportErrorMessage ?? mutationErrorMessage;
  const { transcriptionReady, transcripts, transcriptionError } = liveTransport;

  // Toast is an imperative call into an external system, not a React state
  // update, so this is a legitimate effect — it just reacts to the capture
  // layer's own error state rather than deriving new state from it.
  React.useEffect(() => {
    if (captureErrorMessage) toast.error(captureErrorMessage);
  }, [captureErrorMessage]);

  React.useEffect(() => {
    if (transportErrorMessage) toast.error(transportErrorMessage);
  }, [transportErrorMessage]);

  React.useEffect(() => {
    if (transcriptionError) toast.error(transcriptionError);
  }, [transcriptionError]);

  // Bounded-queue backpressure (Phase 4 §10): if the transport can't keep
  // up, stop capture cleanly rather than letting the queue grow unbounded.
  React.useEffect(() => {
    if (liveTransport.error?.reason === "queue_overflow") {
      void capture.stopCapture();
    }
  }, [liveTransport.error, capture]);

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
  // Title is only ever collected before a session exists — once one has
  // started, it's already been sent and further edits here wouldn't do
  // anything, so lock the field alongside the Start action.
  const isTitleLocked = isStartDisabled;

  async function handleStart() {
    if (isStartDisabled) return; // guards a duplicate session/recorder from a double click

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError("Enter a meeting title");
      return;
    }
    setTitleError(null);

    setSessionPhase("starting");
    setMutationErrorMessage(null);
    setElapsedSeconds(0);
    captureStartRef.current = null;

    let session: Awaited<ReturnType<typeof startMutation.mutateAsync>>;
    try {
      session = await startMutation.mutateAsync(trimmedTitle);
      setMeetingId(session.meetingId);
      setMeetingTitle(session.title);
    } catch (err) {
      const message = extractErrorMessage(err);
      setMutationErrorMessage(message);
      toast.error(message);
      setSessionPhase("error");
      return;
    }

    const token = getAccessTokenCookie();
    if (!token) {
      setMutationErrorMessage("Not authenticated.");
      setSessionPhase("error");
      return;
    }

    try {
      await liveTransport.connect(session.meetingId, token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect audio transport.";
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
    await liveTransport.close();

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
                {meetingTitle ?? (isMicActive ? "Microphone capturing" : "Live Meeting")}
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

        <MeetingTitleInput
          value={title}
          onChange={(value) => {
            setTitle(value);
            if (titleError) setTitleError(null);
          }}
          error={titleError ?? undefined}
          disabled={isTitleLocked}
          autoFocus
        />

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

        {/* Phase 3 + 4 debug readout — capture + transport, nothing further downstream yet. */}
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
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Socket</dt>
            <dd className="font-medium text-foreground">{liveTransport.state}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Last sent #</dt>
            <dd className="font-medium text-foreground">
              {liveTransport.stats.lastSentSequence ?? "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Last acked #</dt>
            <dd className="font-medium text-foreground">
              {liveTransport.stats.lastAckedSequence ?? "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Queued</dt>
            <dd className="font-medium text-foreground">{liveTransport.stats.queued}</dd>
          </div>
        </dl>

        {/* Phase 5: live transcription status + segments as they arrive. No
            final Transcript Viewer, normalization, or summary here — that's
            later phases. */}
        {(phase === "live" || phase === "stopping" || transcripts.length > 0) && (
          <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">Live transcript</span>
              <StatusBadge status={transcriptionReady ? "success" : "info"}>
                {transcriptionReady ? "Connected" : "Transcription starting…"}
              </StatusBadge>
            </div>
            {transcriptionError && (
              <p className="text-xs text-destructive">{transcriptionError}</p>
            )}
            <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto text-xs">
              {transcripts.length === 0 ? (
                <p className="text-muted-foreground">
                  {transcriptionReady ? "Listening for speech…" : "Waiting for transcription to start…"}
                </p>
              ) : (
                transcripts.map((segment) => (
                  <p key={segment.sequence} className="text-foreground">
                    <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">
                      {formatElapsed(Math.floor(segment.start))}
                    </span>
                    {segment.text}
                  </p>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { LiveCapturePanel };
