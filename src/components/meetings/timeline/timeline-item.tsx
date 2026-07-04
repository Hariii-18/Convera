import * as React from "react";

import { cn } from "@/lib/utils";
import { splitHighlight } from "@/components/meetings/format";
import { Timestamp } from "@/components/meetings/timeline/timestamp";
import { TimelineMarker } from "@/components/meetings/timeline/timeline-marker";
import type { TimelineEventData } from "@/components/meetings/timeline/types";

function Highlighted({ text, term }: { text: string; term?: string }) {
  const segments = splitHighlight(text, term);
  return (
    <>
      {segments.map((segment, index) =>
        segment.matched ? (
          <mark
            key={index}
            className="rounded-sm bg-warning/30 text-foreground dark:bg-warning/25"
          >
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        ),
      )}
    </>
  );
}

type TimelineItemProps = React.ComponentProps<"li"> & {
  event: TimelineEventData;
  isLast?: boolean;
  /** Case-insensitive term to highlight within the title/description. UI only. */
  searchTerm?: string;
  onItemClick?: (event: TimelineEventData) => void;
};

/**
 * A single timeline entry: marker, timestamp, title, optional description
 * and speaker. Clicking only calls back to the caller — it never seeks
 * playback itself.
 */
function TimelineItem({
  className,
  event,
  isLast = false,
  searchTerm,
  onItemClick,
  ...props
}: TimelineItemProps) {
  const clickable = Boolean(onItemClick);
  const label = `${event.title} at ${event.timestampSeconds} seconds`;

  return (
    <li
      data-slot="timeline-item"
      role="listitem"
      className={cn("flex gap-3 px-4", className)}
      {...props}
    >
      <TimelineMarker isLast={isLast} />

      {clickable ? (
        <button
          type="button"
          onClick={() => onItemClick?.(event)}
          aria-label={label}
          className="min-w-0 flex-1 rounded-lg py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <TimelineItemContent event={event} searchTerm={searchTerm} />
        </button>
      ) : (
        <div className="min-w-0 flex-1 py-3">
          <TimelineItemContent event={event} searchTerm={searchTerm} />
        </div>
      )}
    </li>
  );
}

function TimelineItemContent({
  event,
  searchTerm,
}: {
  event: TimelineEventData;
  searchTerm?: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Timestamp seconds={event.timestampSeconds} />
        {event.speaker && (
          <span className="text-xs text-muted-foreground">{event.speaker}</span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">
        <Highlighted text={event.title} term={searchTerm} />
      </p>
      {event.description && (
        <p className="mt-0.5 text-sm text-muted-foreground">
          <Highlighted text={event.description} term={searchTerm} />
        </p>
      )}
    </>
  );
}

export { TimelineItem };
export type { TimelineItemProps };
