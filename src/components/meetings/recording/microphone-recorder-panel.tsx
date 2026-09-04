"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatElapsed } from "@/components/processing/format";
import { ProcessingProgress } from "@/components/processing/processing-progress";
import { extractErrorMessage } from "@/features/auth/error";
import type { AudioChunkMeta, CaptureErrorReason } from "@/features/live-meetings/audio-capture";
import { useAudioCapture } from "@/features/live-meetings/hooks/use-audio-capture";
import { useUpload } from "@/features/uploads/hooks/use-upload";
import { ALLOWED_UPLOAD_EXTENSIONS } from "@/features/uploads/constants";
import { cn } from "@/lib/utils";

const CAPTURE_ERROR_MESSAGES: Record<CaptureErrorReason, string> = {
  permission_denied:
    "Microphone access was denied. Allow microphone access in your browser settings and try again.",
  unsupported:
    "This browser doesn't support the audio recording APIs needed to record from your microphone.",
  no_audio_track: "No microphone audio was detected on the selected device.",
  recorder_error: "The recorder stopped unexpectedly.",
  device_lost: "The microphone was disconnected or its access was revoked.",
};

/** Maps a `MediaRecorder` container's base MIME type to a file extension the Upload Engine accepts. */
const MIME_TO_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
};

function isAllowedExtension(extension: string): boolean {
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension);
}

function slugifyTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "recording";
}

type RecordingIssue = "empty" | "unsupported-format";

type RecordingResult = {
  blob: Blob;
  previewUrl: string;
  mimeType: string;
  extension: string;
  filename: string;
  durationSeconds: number;
};

/** Builds one continuous Blob from a completed capture's chunk list, with the container's base MIME type (no `;codecs=` suffix, which the backend rejects as a mismatch). */
function assembleRecording(
  chunks: readonly AudioChunkMeta[],
  durationSeconds: number,
  meetingTitle: string,
): { result: RecordingResult | null; issue: RecordingIssue | null } {
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.blob.size, 0);
  if (chunks.length === 0 || totalBytes === 0) {
    return { result: null, issue: "empty" };
  }

  const rawMimeType = chunks[0]!.mimeType;
  const baseMimeType = rawMimeType.split(";")[0]!.trim().toLowerCase();
  const extension = MIME_TO_EXTENSION[baseMimeType];
  if (!extension || !isAllowedExtension(extension)) {
    return { result: null, issue: "unsupported-format" };
  }

  const blob = new Blob(
    chunks.map((chunk) => chunk.blob),
    { type: baseMimeType },
  );
  const previewUrl = URL.createObjectURL(blob);
  const filename = `${slugifyTitle(meetingTitle)}-mic-${Date.now()}.${extension}`;

  return {
    result: { blob, previewUrl, mimeType: baseMimeType, extension, filename, durationSeconds },
    issue: null,
  };
}

type Step =
  | "idle"
  | "error"
  | "requesting-permission"
  | "recording"
  | "paused"
  | "stopping"
  | "preview"
  | "empty"
  | "unsupported-format"
  | "uploading"
  | "upload-error";

const STATUS_CONFIG: Record<
  Step,
  { label: string; status: "success" | "warning" | "error" | "info" | "neutral" }
> = {
  idle: { label: "Ready", status: "neutral" },
  error: { label: "Error", status: "error" },
  "requesting-permission": { label: "Requesting permission…", status: "info" },
  recording: { label: "Recording", status: "success" },
  paused: { label: "Paused", status: "warning" },
  stopping: { label: "Stopping…", status: "warning" },
  preview: { label: "Ready to save", status: "info" },
  empty: { label: "Empty recording", status: "warning" },
  "unsupported-format": { label: "Unsupported format", status: "error" },
  uploading: { label: "Uploading…", status: "info" },
  "upload-error": { label: "Upload failed", status: "error" },
};

type MicrophoneRecorderPanelProps = {
  meetingId: string;
  meetingTitle: string;
};

/**
 * Record → preview → save-and-process flow for a meeting created with
 * `source_type: "microphone-recording"`. Reuses the same `AudioCaptureController`
 * (via `useAudioCapture`) as Live Meeting for the actual `getUserMedia`/
 * `MediaRecorder` wiring, but records locally and uploads a single Blob
 * through the existing Upload Engine on "Save & Process" instead of
 * streaming chunks over a WebSocket — no `ProcessingJob`/Upload row exists
 * until the user explicitly confirms, so Cancel and an abandoned tab never
 * leave anything behind to clean up.
 */
function MicrophoneRecorderPanel({ meetingId, meetingTitle }: MicrophoneRecorderPanelProps) {
  const router = useRouter();
  const capture = useAudioCapture();
  const upload = useUpload();

  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [recording, setRecording] = React.useState<RecordingResult | null>(null);
  const [recordingIssue, setRecordingIssue] = React.useState<RecordingIssue | null>(null);
  // `upload.isPending` alone can't stop a second click fired in the same
  // tick as the first — `mutate()` dispatches its pending state
  // asynchronously, so a rapid double-click can read `isPending: false`
  // twice from the same stale render before either update lands. This ref
  // is set synchronously the instant the first click is handled.
  const isSubmittingRef = React.useRef(false);

  // Elapsed timer only ticks while actively capturing — paused/stopped freezes it for free.
  React.useEffect(() => {
    if (capture.state !== "capturing") return;
    const interval = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(interval);
  }, [capture.state]);

  // Revoke the previous preview URL whenever a new one replaces it or the panel unmounts.
  React.useEffect(() => {
    const url = recording?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [recording]);

  const captureErrorMessage = capture.error
    ? (CAPTURE_ERROR_MESSAGES[capture.error.reason] ?? capture.error.message)
    : null;

  React.useEffect(() => {
    if (captureErrorMessage) toast.error(captureErrorMessage);
  }, [captureErrorMessage]);

  const step: Step = capture.error
    ? "error"
    : recordingIssue === "empty"
      ? "empty"
      : recordingIssue === "unsupported-format"
        ? "unsupported-format"
        : recording
          ? upload.isPending
            ? "uploading"
            : upload.isError
              ? "upload-error"
              : "preview"
          : capture.state === "requesting_permission"
            ? "requesting-permission"
            : capture.state === "capturing"
              ? "recording"
              : capture.state === "paused"
                ? "paused"
                : capture.state === "stopping"
                  ? "stopping"
                  : "idle";

  const hasError = Boolean(capture.error);
  const statusConfig = STATUS_CONFIG[step];

  function resetForNewAttempt() {
    setRecordingIssue(null);
    setRecording(null);
    upload.reset();
    setElapsedSeconds(0);
    isSubmittingRef.current = false;
  }

  async function handleStart() {
    resetForNewAttempt();
    await capture.startCapture();
  }

  function handlePause() {
    capture.pause();
  }

  function handleResume() {
    capture.resume();
  }

  async function handleStop() {
    const finalChunks = await capture.stopCapture();
    const { result, issue } = assembleRecording(finalChunks, elapsedSeconds, meetingTitle);
    if (issue) {
      setRecordingIssue(issue);
      return;
    }
    setRecording(result);
  }

  function handleCancel() {
    capture.cancelCapture();
    setElapsedSeconds(0);
  }

  async function handleRecordAgain() {
    resetForNewAttempt();
    await capture.startCapture();
  }

  function handleSaveAndProcess() {
    if (!recording || upload.isPending || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const file = new File([recording.blob], recording.filename, { type: recording.mimeType });
    upload.mutate(
      { file, meetingId },
      {
        onSuccess: () => {
          toast.success("Recording uploaded successfully");
          toast("Queued for processing");
          router.push(`/meetings/${meetingId}`);
        },
        onError: (mutationError) => {
          isSubmittingRef.current = false;
          toast.error(extractErrorMessage(mutationError));
        },
      },
    );
  }

  const isMicActive = step === "recording";
  const showRecordingControls =
    step === "idle" ||
    step === "error" ||
    step === "requesting-permission" ||
    step === "recording" ||
    step === "paused" ||
    step === "stopping";
  const showResultControls =
    step === "preview" || step === "uploading" || step === "upload-error" || step === "empty" || step === "unsupported-format";
  const showAudioPreview =
    recording && (step === "preview" || step === "uploading" || step === "upload-error");

  const durationLabel =
    step === "requesting-permission"
      ? "Waiting for microphone permission…"
      : step === "idle" || step === "error"
        ? "Not recording"
        : formatElapsed(recording ? recording.durationSeconds : elapsedSeconds);

  return (
    <Card data-slot="microphone-recorder-panel">
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden="true"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                isMicActive
                  ? "bg-success/10 text-success"
                  : hasError || step === "unsupported-format" || step === "upload-error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {hasError || step === "unsupported-format" ? (
                <MicOff className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{meetingTitle}</span>
              <span className="text-xs text-muted-foreground">{durationLabel}</span>
            </div>
          </div>
          <StatusBadge status={statusConfig.status}>{statusConfig.label}</StatusBadge>
        </div>

        {hasError && captureErrorMessage && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs">{captureErrorMessage}</p>
          </div>
        )}

        {step === "empty" && (
          <p className="text-xs text-muted-foreground">
            This recording didn&apos;t capture any audio. Check your microphone and try again.
          </p>
        )}

        {step === "unsupported-format" && (
          <p className="text-xs text-muted-foreground">
            This browser&apos;s recording format can&apos;t be uploaded. Try a different browser.
          </p>
        )}

        {showAudioPreview && recording && (
          <audio controls src={recording.previewUrl} className="w-full" />
        )}

        {step === "uploading" && <ProcessingProgress percentage={upload.progress} label="Upload" />}

        {step === "upload-error" && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs">{extractErrorMessage(upload.error)}</p>
          </div>
        )}

        {showRecordingControls && (
          <div className="flex flex-wrap items-center gap-2">
            {(step === "idle" || step === "error" || step === "requesting-permission") && (
              <Button onClick={handleStart} disabled={step === "requesting-permission"}>
                {step === "requesting-permission" ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Mic data-icon="inline-start" />
                )}
                Start Recording
              </Button>
            )}
            {step === "recording" && (
              <Button variant="outline" onClick={handlePause}>
                <Pause data-icon="inline-start" />
                Pause
              </Button>
            )}
            {step === "paused" && (
              <Button variant="outline" onClick={handleResume}>
                <Play data-icon="inline-start" />
                Resume
              </Button>
            )}
            {(step === "recording" || step === "paused" || step === "stopping") && (
              <Button variant="outline" onClick={handleStop} disabled={step === "stopping"}>
                {step === "stopping" ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Square data-icon="inline-start" />
                )}
                Stop
              </Button>
            )}
            {(step === "recording" || step === "paused") && (
              <Button variant="ghost" onClick={handleCancel}>
                <X data-icon="inline-start" />
                Cancel
              </Button>
            )}
          </div>
        )}

        {showResultControls && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleRecordAgain} disabled={step === "uploading"}>
              <RotateCcw data-icon="inline-start" />
              Record Again
            </Button>
            {(step === "preview" || step === "uploading" || step === "upload-error") && (
              <Button onClick={handleSaveAndProcess} disabled={step === "uploading"}>
                {step === "uploading" && <Loader2 className="animate-spin" data-icon="inline-start" />}
                {step === "upload-error" ? "Retry Save & Process" : "Save & Process"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { MicrophoneRecorderPanel };
