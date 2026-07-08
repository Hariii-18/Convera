import type { statusBadgeVariants } from "@/components/ui/status-badge";
import type { VariantProps } from "class-variance-authority";
import type { Meeting } from "@/components/meetings/types";

/**
 * A meeting only reaches "completed" once its transcript has been saved (see
 * the backend's processing pipeline), so transcript readiness can be derived
 * from meeting status alone without a separate transcript lookup per row.
 */
export type TranscriptStatus = "unavailable" | "pending" | "processing" | "ready" | "failed";

type BadgeStatus = NonNullable<VariantProps<typeof statusBadgeVariants>["status"]>;

export const transcriptStatusConfig: Record<
  TranscriptStatus,
  { label: string; badgeStatus: BadgeStatus }
> = {
  unavailable: { label: "No meeting", badgeStatus: "neutral" },
  pending: { label: "Pending", badgeStatus: "neutral" },
  processing: { label: "Processing", badgeStatus: "info" },
  ready: { label: "Ready", badgeStatus: "success" },
  failed: { label: "Failed", badgeStatus: "error" },
};

export function getTranscriptStatus(meeting: Meeting | undefined | null): TranscriptStatus {
  if (!meeting) return "unavailable";

  switch (meeting.status) {
    case "scheduled":
      return "pending";
    case "processing":
      return "processing";
    case "completed":
      return "ready";
    case "failed":
      return "failed";
  }
}
