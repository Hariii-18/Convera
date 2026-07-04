import * as React from "react";
import { Cpu } from "lucide-react";
import type { VariantProps } from "class-variance-authority";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type statusBadgeVariants } from "@/components/ui/status-badge";
import { formatDuration } from "@/components/meetings/format";
import { MetaRow } from "@/components/meetings/meta-row";
import type {
  ProcessingInfoData,
  SummaryStatus,
  TranscriptStatus,
} from "@/components/meetings/info-panel/types";
import { cn } from "@/lib/utils";

type BadgeStatus = NonNullable<VariantProps<typeof statusBadgeVariants>["status"]>;

const transcriptStatusConfig: Record<TranscriptStatus, { label: string; status: BadgeStatus }> = {
  pending: { label: "Pending", status: "neutral" },
  processing: { label: "Processing", status: "info" },
  completed: { label: "Completed", status: "success" },
  failed: { label: "Failed", status: "error" },
};

const summaryStatusConfig: Record<SummaryStatus, { label: string; status: BadgeStatus }> = {
  pending: { label: "Pending", status: "neutral" },
  generating: { label: "Generating", status: "info" },
  generated: { label: "Generated", status: "success" },
  failed: { label: "Failed", status: "error" },
};

type ProcessingInfoProps = React.ComponentProps<"div"> & {
  data?: ProcessingInfoData;
  loading?: boolean;
};

/**
 * Pipeline status for the workspace info rail: processing time, transcript
 * status, and summary status. Purely presentational — it never runs or
 * polls the pipeline itself.
 */
function ProcessingInfo({
  className,
  data,
  loading = false,
  ...props
}: ProcessingInfoProps) {
  return (
    <Card data-slot="processing-info" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Processing</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : !data ? (
          <EmptyState
            icon={<Cpu />}
            title="No processing data"
            description="Processing details will show up here once available."
          />
        ) : (
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
            <MetaRow label="Processing time">
              {formatDuration(data.processingTimeSeconds)}
            </MetaRow>
            {data.transcriptStatus && (
              <MetaRow label="Transcript">
                <StatusBadge status={transcriptStatusConfig[data.transcriptStatus].status}>
                  {transcriptStatusConfig[data.transcriptStatus].label}
                </StatusBadge>
              </MetaRow>
            )}
            {data.summaryStatus && (
              <MetaRow label="Summary">
                <StatusBadge status={summaryStatusConfig[data.summaryStatus].status}>
                  {summaryStatusConfig[data.summaryStatus].label}
                </StatusBadge>
              </MetaRow>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export { ProcessingInfo };
export type { ProcessingInfoProps };
