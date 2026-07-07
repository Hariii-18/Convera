import * as React from "react";
import { ListChecks, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProcessingProgress } from "@/components/processing/processing-progress";
import { ProcessingStatus } from "@/components/processing/processing-status";
import { formatElapsed } from "@/components/processing/format";
import { formatDateTime } from "@/components/meetings/format";
import { cn } from "@/lib/utils";
import type { ProcessingStage } from "@/components/processing/types";
import type { ProcessingJob } from "@/features/processing/mappers";

type ProcessingJobsTableProps = React.ComponentProps<"div"> & {
  jobs: ProcessingJob[];
  isLoading?: boolean;
  /** Meeting title lookup by id, so rows can show a human-readable name. */
  meetingTitles: Map<string, string>;
  /** Current wall-clock time, supplied by the caller so every row's elapsed time ticks in sync. */
  now: number;
  onRetry?: (job: ProcessingJob) => void;
  isRetrying?: (job: ProcessingJob) => boolean;
  onViewMeeting?: (meetingId: string) => void;
};

function toProcessingStage(status: ProcessingJob["status"]): ProcessingStage {
  return status;
}

function elapsedSeconds(job: ProcessingJob, now: number): number {
  const startMs = new Date(job.startedAt ?? job.createdAt).getTime();
  const endMs = job.completedAt ? new Date(job.completedAt).getTime() : now;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function ProcessingJobsTableSkeleton({ rowCount = 4 }: { rowCount?: number }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-2">
      <span role="status" className="sr-only">
        Loading processing jobs&hellip;
      </span>
      {Array.from({ length: rowCount }).map((_, index) => (
        <div key={index} className="flex items-center gap-4" aria-hidden="true">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-1.5 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Table view of processing jobs: meeting, status, progress, current stage,
 * elapsed/created time, and row actions. Purely presentational — it never
 * fetches or fabricates data, so the caller owns loading/empty state and
 * what retry actually does.
 */
function ProcessingJobsTable({
  jobs,
  isLoading = false,
  meetingTitles,
  now,
  onRetry,
  isRetrying,
  onViewMeeting,
  className,
  ...props
}: ProcessingJobsTableProps) {
  if (isLoading) {
    return (
      <div data-slot="processing-jobs-table" className={cn("w-full", className)} {...props}>
        <ProcessingJobsTableSkeleton />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div data-slot="processing-jobs-table" className={cn("w-full", className)} {...props}>
        <EmptyState
          icon={<ListChecks />}
          title="Nothing processing"
          description="Meetings you upload will show up here while they're queued, prepared, and processed."
          className="mx-4"
        />
      </div>
    );
  }

  return (
    <div data-slot="processing-jobs-table" className={cn("w-full", className)} {...props}>
      <Table aria-label="Processing jobs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Meeting</TableHead>
            <TableHead className="w-px whitespace-nowrap">Status</TableHead>
            <TableHead className="min-w-40">Progress</TableHead>
            <TableHead className="w-px whitespace-nowrap">Stage</TableHead>
            <TableHead className="w-px whitespace-nowrap">Elapsed</TableHead>
            <TableHead className="w-px whitespace-nowrap">Created</TableHead>
            <TableHead className="w-px whitespace-nowrap pr-4 text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const title = meetingTitles.get(job.meetingId) ?? "Untitled meeting";
            const stage = toProcessingStage(job.status);
            const percentage =
              job.status === "queued" ? undefined : job.progress;

            return (
              <TableRow key={job.id}>
                <TableCell className="py-3 pl-4">
                  <button
                    type="button"
                    onClick={() => onViewMeeting?.(job.meetingId)}
                    className="max-w-56 truncate text-left text-sm font-medium text-foreground hover:underline"
                    title={title}
                  >
                    {title}
                  </button>
                </TableCell>
                <TableCell className="w-px whitespace-nowrap">
                  <ProcessingStatus stage={stage} />
                </TableCell>
                <TableCell className="min-w-40">
                  <ProcessingProgress percentage={percentage} label={job.stage} />
                </TableCell>
                <TableCell className="w-px max-w-40 truncate whitespace-nowrap text-muted-foreground">
                  {job.status === "failed" ? job.errorMessage ?? job.stage : job.stage}
                </TableCell>
                <TableCell className="w-px whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatElapsed(elapsedSeconds(job, now))}
                </TableCell>
                <TableCell className="w-px whitespace-nowrap text-muted-foreground">
                  {formatDateTime(job.createdAt)}
                </TableCell>
                <TableCell className="w-px whitespace-nowrap pr-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry?.(job)}
                      disabled={job.status !== "failed" || isRetrying?.(job)}
                    >
                      <RotateCw data-icon="inline-start" />
                      Retry
                    </Button>
                    <Button variant="ghost" size="sm" disabled title="Cancel isn't available yet">
                      Cancel
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export { ProcessingJobsTable };
export type { ProcessingJobsTableProps };
