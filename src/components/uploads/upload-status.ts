import type { UploadStatus } from "@/features/uploads/types";
import type { statusBadgeVariants } from "@/components/ui/status-badge";
import type { VariantProps } from "class-variance-authority";

type BadgeStatus = NonNullable<VariantProps<typeof statusBadgeVariants>["status"]>;

export const uploadStatusConfig: Record<
  UploadStatus,
  { label: string; badgeStatus: BadgeStatus }
> = {
  uploading: { label: "Uploading", badgeStatus: "info" },
  uploaded: { label: "Uploaded", badgeStatus: "success" },
  failed: { label: "Failed", badgeStatus: "error" },
  deleted: { label: "Deleted", badgeStatus: "neutral" },
};
