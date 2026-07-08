import { Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import {
  transcriptStatusConfig,
  type TranscriptStatus,
} from "@/components/uploads/transcript-status";

function TranscriptStatusBadge({ status }: { status: TranscriptStatus }) {
  const { label, badgeStatus } = transcriptStatusConfig[status];

  if (status === "processing") {
    return (
      <StatusBadge status={badgeStatus} dot={false}>
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
        {label}
      </StatusBadge>
    );
  }

  return <StatusBadge status={badgeStatus}>{label}</StatusBadge>;
}

export { TranscriptStatusBadge };
