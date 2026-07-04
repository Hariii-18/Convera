import * as React from "react";
import { FileQuestion } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingStatusBadge } from "@/components/meetings/meeting-status-badge";
import { formatDate, formatDateTime, formatDuration } from "@/components/meetings/format";
import { MetaRow } from "@/components/meetings/meta-row";
import { cn } from "@/lib/utils";
import type { MeetingMetadataData } from "@/components/meetings/overview/types";

type MeetingMetadataProps = React.ComponentProps<"div"> & {
  data?: MeetingMetadataData;
  loading?: boolean;
};

/**
 * Key facts about the meeting: title, status, duration, and timestamps.
 * Purely presentational — callers own loading/empty state via `loading`/`data`.
 */
function MeetingMetadata({
  className,
  data,
  loading = false,
  ...props
}: MeetingMetadataProps) {
  return (
    <Card
      data-slot="meeting-metadata"
      className={cn(className)}
      {...props}
    >
      <CardHeader>
        <CardTitle as="h2">Details</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : !data ? (
          <EmptyState
            icon={<FileQuestion />}
            title="No details yet"
            description="Meeting metadata will appear here once available."
          />
        ) : (
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-3">
            <MetaRow label="Title">
              <span className="line-clamp-2">{data.title}</span>
            </MetaRow>
            <MetaRow label="Status">
              <MeetingStatusBadge status={data.status} />
            </MetaRow>
            <MetaRow label="Duration">
              {formatDuration(data.durationSeconds)}
            </MetaRow>
            <MetaRow label="Created">
              <time
                dateTime={new Date(data.createdAt).toISOString()}
                title={formatDateTime(data.createdAt)}
              >
                {formatDate(data.createdAt)}
              </time>
            </MetaRow>
            <MetaRow label="Last updated">
              <time
                dateTime={new Date(data.updatedAt).toISOString()}
                title={formatDateTime(data.updatedAt)}
              >
                {formatDate(data.updatedAt)}
              </time>
            </MetaRow>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export { MeetingMetadata };
export type { MeetingMetadataProps };
