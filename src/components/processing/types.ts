/**
 * Domain types for the processing queue feature. Shared by ProcessingQueue
 * and any future consumer (Dashboard, Meetings page) so they stay in sync.
 */

export type ProcessingStage =
  | "queued"
  | "uploading"
  | "preparing"
  | "processing"
  | "chunking"
  | "transcribing"
  | "summarizing"
  | "finalizing"
  | "completed"
  | "failed";

export type ProcessingQueueItem = {
  id: string;
  title: string;
  stage: ProcessingStage;
  /** 0-100. Omit while the stage has no measurable progress — renders an indeterminate bar instead of a fabricated number. */
  percentage?: number;
  /** Seconds elapsed since processing started. Supplied by the caller; this module runs no timers of its own. */
  elapsedSeconds: number;
  /** Short human-readable description of what's happening right now, e.g. "Uploading audio.wav (12 MB)". */
  currentOperation?: string;
  /** Shown in place of `currentOperation` when `stage` is "failed", e.g. "Audio file exceeded the 2 hour limit". */
  errorMessage?: string;
};
