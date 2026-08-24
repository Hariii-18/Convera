import * as React from "react";
import { MessagesSquare } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TranscriptBlock } from "@/components/meetings/transcript/transcript-block";
import { cn } from "@/lib/utils";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";

type DetailedDiscussionProps = React.ComponentProps<"div"> & {
  segments?: TranscriptBlockData[];
  loading?: boolean;
  onTimestampClick?: (seconds: number) => void;
};

/**
 * Timestamped discussion segments underlying the summary above — the exact
 * segment timestamps from the transcript, never re-derived. Reuses
 * `TranscriptBlock` so a segment reads identically here and on the
 * Transcript tab.
 */
function DetailedDiscussion({
  className,
  segments = [],
  loading = false,
  onTimestampClick,
  ...props
}: DetailedDiscussionProps) {
  return (
    <Card data-slot="detailed-discussion" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Detailed Discussion</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="flex flex-col gap-4 px-(--card-spacing)" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        ) : segments.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare />}
            title="No detailed discussion yet"
            description="Timestamped discussion segments will appear here once this meeting is transcribed."
            className="mx-(--card-spacing) rounded-none border-0"
          />
        ) : (
          <div
            role="list"
            aria-label="Detailed discussion"
            className="flex max-h-[28rem] flex-col divide-y divide-border overflow-y-auto"
          >
            {segments.map((segment) => (
              <div key={segment.id} role="listitem">
                <TranscriptBlock block={segment} onTimestampClick={onTimestampClick} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { DetailedDiscussion };
export type { DetailedDiscussionProps };
