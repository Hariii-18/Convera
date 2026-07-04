"use client";

import * as React from "react";
import { History } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { TimelineItem } from "@/components/meetings/timeline/timeline-item";
import { TimelineSkeleton } from "@/components/meetings/timeline/timeline-skeleton";
import { TimelineToolbar } from "@/components/meetings/timeline/timeline-toolbar";
import type { TimelineEventData } from "@/components/meetings/timeline/types";

type TimelineViewerProps = React.ComponentProps<"div"> & {
  events?: TimelineEventData[];
  isLoading?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Controlled — the caller owns what expanding/collapsing actually does. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onItemClick?: (event: TimelineEventData) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonCount?: number;
};

/**
 * Interactive meeting timeline: toolbar (search, event count, expand/collapse
 * placeholder) over a vertical list of key moments. Every entry renders from
 * `events` alone — no API calls and no transcript seeking, only callbacks.
 */
function TimelineViewer({
  className,
  events = [],
  isLoading = false,
  searchValue,
  onSearchChange,
  expanded,
  onExpandedChange,
  onItemClick,
  emptyTitle = "No timeline yet",
  emptyDescription = "Key moments from this meeting will appear here.",
  skeletonCount = 5,
  ...props
}: TimelineViewerProps) {
  return (
    <div
      data-slot="timeline-viewer"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      <TimelineToolbar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        eventCount={events.length > 0 ? events.length : undefined}
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        className="border-b border-border"
      />

      {isLoading ? (
        <div className="max-h-[32rem] overflow-y-auto py-3">
          <span role="status" className="sr-only">
            Loading timeline&hellip;
          </span>
          <TimelineSkeleton count={skeletonCount} />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<History />}
          title={emptyTitle}
          description={emptyDescription}
          className="rounded-none border-0"
        />
      ) : (
        <ol
          role="list"
          aria-label="Meeting timeline"
          className="max-h-[32rem] overflow-y-auto py-1"
        >
          {events.map((event, index) => (
            <TimelineItem
              key={event.id}
              event={event}
              isLast={index === events.length - 1}
              searchTerm={searchValue}
              onItemClick={onItemClick}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

export { TimelineViewer };
export type { TimelineViewerProps };
