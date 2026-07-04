import * as React from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

type TimelineToolbarProps = React.ComponentProps<"div"> & {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Pre-counted event total, shown as-is. */
  eventCount?: number;
  /** Controlled — the caller owns what expanding/collapsing actually does. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

/**
 * Action bar for the timeline: search, event count, and an expand/collapse
 * placeholder. Every action is a callback into the caller — this component
 * holds no timeline state of its own.
 */
function TimelineToolbar({
  className,
  searchValue = "",
  onSearchChange,
  eventCount,
  expanded = false,
  onExpandedChange,
  ...props
}: TimelineToolbarProps) {
  return (
    <div
      data-slot="timeline-toolbar"
      className={cn("flex flex-wrap items-center gap-3 px-4 py-3", className)}
      {...props}
    >
      <SearchInput
        value={searchValue}
        onChange={(event) => onSearchChange?.(event.target.value)}
        onClear={onSearchChange ? () => onSearchChange("") : undefined}
        placeholder="Search timeline…"
        containerClassName="max-w-xs"
        aria-label="Search timeline"
      />

      {eventCount !== undefined && (
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {eventCount.toLocaleString("en-US")}{" "}
          {eventCount === 1 ? "event" : "events"}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={expanded}
          onClick={() => onExpandedChange?.(!expanded)}
          disabled={!onExpandedChange}
        >
          {expanded ? (
            <ChevronsDownUp data-icon="inline-start" />
          ) : (
            <ChevronsUpDown data-icon="inline-start" />
          )}
          {expanded ? "Collapse" : "Expand"}
        </Button>
      </div>
    </div>
  );
}

export { TimelineToolbar };
export type { TimelineToolbarProps };
