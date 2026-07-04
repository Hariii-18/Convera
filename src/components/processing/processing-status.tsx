import { Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { getProcessingStatus } from "@/components/processing/processing-stage";
import type { ProcessingStage } from "@/components/processing/types";

function ProcessingStatus({
  stage,
  className,
}: {
  stage: ProcessingStage;
  className?: string;
}) {
  const status = getProcessingStatus(stage);

  if (status === "processing") {
    return (
      <StatusBadge status="info" dot={false} className={className}>
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
        Processing
      </StatusBadge>
    );
  }

  if (status === "completed") {
    return (
      <StatusBadge status="success" className={className}>
        Completed
      </StatusBadge>
    );
  }

  return (
    <StatusBadge status="error" className={className}>
      Failed
    </StatusBadge>
  );
}

export { ProcessingStatus };
