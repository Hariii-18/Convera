/**
 * Domain types for the Meeting Information Panel. Shared by MeetingInfoPanel
 * and its subcomponents so a real page can pass one data shape straight
 * through.
 */

export type Participant = {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string;
};

export type RecordingType = "audio" | "video" | "screen-recording";

export type RecordingInfoData = {
  type: RecordingType;
  /** Total length in seconds. Omit or null while duration is unknown. */
  durationSeconds?: number | null;
  sizeBytes?: number;
  /** Pre-formatted quality label, e.g. "High · 48kHz". */
  quality?: string;
};

export type TranscriptStatus = "pending" | "processing" | "completed" | "failed";

export type SummaryStatus = "pending" | "generating" | "generated" | "failed";

export type ProcessingInfoData = {
  /** Seconds the pipeline took to finish processing. */
  processingTimeSeconds?: number;
  transcriptStatus?: TranscriptStatus;
  summaryStatus?: SummaryStatus;
};

export type MeetingTag = {
  id: string;
  label: string;
};
