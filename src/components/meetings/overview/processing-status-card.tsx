import * as React from "react";
import { CheckCircle2, Cpu, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProcessingProgress } from "@/components/processing/processing-progress";
import { ProcessingStatus } from "@/components/processing/processing-status";
import { formatElapsed } from "@/components/processing/format";
import { cn } from "@/lib/utils";
import { isRetryableStatus } from "@/features/processing/mappers";
import type { ProcessingJob } from "@/features/processing/mappers";
import type { MeetingStatus } from "@/components/meetings/types";

type ProcessingStatusCardProps = React.ComponentProps<"div"> & {
  job?: ProcessingJob | null;
  loading?: boolean;
  /**
   * The parent Meeting's own status. Live Meeting finalization never
   * creates a `ProcessingJob` row (it runs the post-transcription pipeline
   * straight through), so `job` alone can't tell a meeting that's genuinely
   * never started from one that's already fully processed — this fills
   * that gap so a completed meeting doesn't get stuck on "Not yet
   * processing" forever.
   */
  meetingStatus?: MeetingStatus;
  /** Presentational only — the caller owns what retrying actually does. */
  onRetry?: () => void;
  isRetrying?: boolean;
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
  meetingStatus,
  onRetry,
  isRetrying = false,
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
        ) : !job && meetingStatus === "completed" ? (
          <EmptyState
            icon={<CheckCircle2 />}
            title="Processing completed"
            description="This meeting finished processing without a tracked job (typical for a finalized Live Meeting)."
          />
        ) : !job && meetingStatus === "failed" ? (
          <EmptyState
            icon={<Cpu />}
            title="Processing failed"
            description="This meeting didn't finish processing. Try again from the meeting menu."
          />
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
            {isRetryableStatus(job.status) && onRetry && (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={onRetry}
                disabled={isRetrying}
              >
                <RotateCw data-icon="inline-start" />
                {isRetrying ? "Retrying…" : "Retry"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { ProcessingStatusCard };
export type { ProcessingStatusCardProps };
