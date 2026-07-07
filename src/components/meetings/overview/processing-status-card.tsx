import * as React from "react";
import { Cpu } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProcessingProgress } from "@/components/processing/processing-progress";
import { ProcessingStatus } from "@/components/processing/processing-status";
import { formatElapsed } from "@/components/processing/format";
import { cn } from "@/lib/utils";
import type { ProcessingJob } from "@/features/processing/mappers";

type ProcessingStatusCardProps = React.ComponentProps<"div"> & {
  job?: ProcessingJob | null;
  loading?: boolean;
};

function elapsedSeconds(job: ProcessingJob): number {
  const startMs = new Date(job.startedAt ?? job.createdAt).getTime();
  const endMs = job.completedAt
    ? new Date(job.completedAt).getTime()
    : Date.now();
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

/**
 * Live view of this meeting's processing job: status badge, progress, and
 * elapsed time. Renders from `job` alone — the caller owns fetching/polling
 * (see `useProcessingJob`).
 */
function ProcessingStatusCard({
  className,
  job,
  loading = false,
  ...props
}: ProcessingStatusCardProps) {
  return (
    <Card data-slot="processing-status-card" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Processing status</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ) : !job ? (
          <EmptyState
            icon={<Cpu />}
            title="Not yet processing"
            description="Upload a recording to this meeting to start processing."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <ProcessingStatus stage={job.status} />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatElapsed(elapsedSeconds(job))} elapsed
              </span>
            </div>
            <ProcessingProgress
              percentage={job.status === "queued" ? undefined : job.progress}
              label={job.stage}
            />
            {job.status === "failed" && job.errorMessage && (
              <p className="text-xs text-destructive">{job.errorMessage}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { ProcessingStatusCard };
export type { ProcessingStatusCardProps };
