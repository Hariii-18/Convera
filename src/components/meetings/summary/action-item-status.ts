import type { statusBadgeVariants } from "@/components/ui/status-badge";
import type { VariantProps } from "class-variance-authority";
import type { ActionItemStatus } from "@/components/meetings/summary/types";

type BadgeStatus = NonNullable<
  VariantProps<typeof statusBadgeVariants>["status"]
>;

export const actionItemStatusConfig: Record<
  ActionItemStatus,
  { label: string; badgeStatus: BadgeStatus }
> = {
  "not-started": { label: "Not started", badgeStatus: "neutral" },
  "in-progress": { label: "In progress", badgeStatus: "info" },
  completed: { label: "Completed", badgeStatus: "success" },
  blocked: { label: "Blocked", badgeStatus: "error" },
};
