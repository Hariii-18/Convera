import type { MeetingStatus } from "@/components/meetings/types";
import type { statusBadgeVariants } from "@/components/ui/status-badge";
import type { VariantProps } from "class-variance-authority";

type BadgeStatus = NonNullable<VariantProps<typeof statusBadgeVariants>["status"]>;

export const meetingStatusConfig: Record<
  MeetingStatus,
  { label: string; badgeStatus: BadgeStatus }
> = {
  scheduled: { label: "Scheduled", badgeStatus: "neutral" },
  processing: { label: "Processing", badgeStatus: "info" },
  completed: { label: "Completed", badgeStatus: "success" },
  failed: { label: "Failed", badgeStatus: "error" },
};
