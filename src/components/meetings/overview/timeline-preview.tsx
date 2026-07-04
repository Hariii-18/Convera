import * as React from "react";
import { ArrowRight, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TimelineEventPreview } from "@/components/meetings/overview/types";

type TimelinePreviewProps = React.ComponentProps<"div"> & {
  events?: TimelineEventPreview[];
  loading?: boolean;
  /** Number of leading events to show. Defaults to 3. */
  maxEvents?: number;
  onViewTimeline?: () => void;
};

/**
 * Leading slice of the meeting timeline with a link to the full Timeline
 * tab. Shows whatever `events` is passed — it never invents entries.
 */
function TimelinePreview({
  className,
  events,
  loading = false,
  maxEvents = 3,
  onViewTimeline,
  ...props
}: TimelinePreviewProps) {
  const visibleEvents = events?.slice(0, maxEvents) ?? [];

  return (
    <Card data-slot="timeline-preview" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Timeline</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewTimeline}
            disabled={!onViewTimeline}
          >
            View timeline
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3">
                <Skeleton className="h-3.5 w-10 shrink-0" />
                <Skeleton className="h-3.5 flex-1" />
              </div>
            ))}
          </div>
        ) : visibleEvents.length === 0 ? (
          <EmptyState
            icon={<History />}
            title="No timeline yet"
            description="Key moments from this meeting will appear here."
          />
        ) : (
          <ol role="list" className="flex flex-col gap-4">
            {visibleEvents.map((event) => (
              <li key={event.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {event.timeLabel}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {event.label}
                  </p>
                  {event.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {event.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export { TimelinePreview };
export type { TimelinePreviewProps };
