import { Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { meetingStatusConfig } from "@/components/meetings/meeting-status";
import type { MeetingStatus } from "@/components/meetings/types";

function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const { label, badgeStatus } = meetingStatusConfig[status];

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

export { MeetingStatusBadge };
