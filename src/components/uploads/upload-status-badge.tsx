import { Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { uploadStatusConfig } from "@/components/uploads/upload-status";
import type { UploadStatus } from "@/features/uploads/types";

function UploadStatusBadge({ status }: { status: UploadStatus }) {
  const { label, badgeStatus } = uploadStatusConfig[status];

  if (status === "uploading") {
    return (
      <StatusBadge status={badgeStatus} dot={false}>
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
        {label}
      </StatusBadge>
    );
  }

  return <StatusBadge status={badgeStatus}>{label}</StatusBadge>;
}

export { UploadStatusBadge };
