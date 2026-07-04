import type { LucideIcon } from "lucide-react";

import type { MeetingStatus } from "@/components/meetings/types";

/**
 * Domain types for the meeting Overview tab. Shared by MeetingOverview and
 * its subcomponents so a real page can pass one data shape straight through.
 */

export type SummaryStatus = "pending" | "generating" | "generated" | "failed";

export type RecordingType = "audio" | "video" | "screen-recording";

export type MeetingMetadataData = {
  title: string;
  status: MeetingStatus;
  /** Total length in seconds. Omit or null while duration is unknown (e.g. still processing). */
  durationSeconds?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type MeetingStatisticsData = {
  transcriptWordCount?: number;
  /** Seconds the pipeline took to finish processing. */
  processingTimeSeconds?: number;
  summaryStatus?: SummaryStatus;
  recordingSizeBytes?: number;
};

export type RecordingInfo = {
  type: RecordingType;
  /** Total length in seconds. Omit or null while duration is unknown. */
  durationSeconds?: number | null;
  /** Pre-formatted quality label, e.g. "High · 48kHz". */
  audioQuality?: string;
};

export type TimelineEventPreview = {
  id: string;
  label: string;
  /** Pre-formatted position in the meeting, e.g. "12:34" or "Minute 12". */
  timeLabel: string;
  description?: string;
};

export type ActivityEventType =
  | "processing-completed"
  | "transcript-edited"
  | "summary-generated"
  | "recording-uploaded"
  | "meeting-created";

export type ActivityItem = {
  id: string;
  type: ActivityEventType;
  timestamp: string | Date;
  /** Overrides the type's default label, e.g. "Transcript edited by Priya". */
  description?: string;
};

export type ActivityTypeConfigEntry = {
  label: string;
  icon: LucideIcon;
};
