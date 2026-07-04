"use client";

import * as React from "react";
import { Video } from "lucide-react";

import { Table, TableBody } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { MeetingsTableHeader } from "@/components/meetings/meeting-table-header";
import { MeetingsTableSkeleton } from "@/components/meetings/meeting-row-skeleton";
import { MeetingRow } from "@/components/meetings/meeting-row";
import type { Meeting } from "@/components/meetings/types";

type MeetingsTableProps = React.ComponentProps<"div"> & {
  meetings: Meeting[];
  isLoading?: boolean;
  skeletonRowCount?: number;
  onView?: (meeting: Meeting) => void;
  onRename?: (meeting: Meeting) => void;
  onDownload?: (meeting: Meeting) => void;
  onDelete?: (meeting: Meeting) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
};

/**
 * Meeting list rendered as a table. Purely presentational: it never fetches
 * or fabricates data, so callers own loading/empty state by passing
 * `meetings`, `isLoading`, and the row action callbacks.
 */
function MeetingsTable({
  meetings,
  isLoading = false,
  skeletonRowCount = 5,
  onView,
  onRename,
  onDownload,
  onDelete,
  emptyTitle = "No meetings yet",
  emptyDescription = "Meetings you record or upload will show up here.",
  emptyAction,
  className,
  ...props
}: MeetingsTableProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rowRefs = React.useRef<Array<HTMLTableRowElement | null>>([]);

  function focusRow(index: number) {
    const clamped = Math.max(0, Math.min(index, meetings.length - 1));
    setActiveIndex(clamped);
    rowRefs.current[clamped]?.focus();
  }

  function handleRowKeyDown(
    event: React.KeyboardEvent<HTMLTableRowElement>,
    index: number,
  ) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusRow(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusRow(0);
        break;
      case "End":
        event.preventDefault();
        focusRow(meetings.length - 1);
        break;
    }
  }

  if (isLoading) {
    return (
      <div
        data-slot="meetings-table"
        className={cn("w-full", className)}
        {...props}
      >
        <span role="status" className="sr-only">
          Loading meetings&hellip;
        </span>
        <MeetingsTableSkeleton rowCount={skeletonRowCount} />
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div
        data-slot="meetings-table"
        className={cn("w-full", className)}
        {...props}
      >
        <EmptyState
          icon={<Video />}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
          className="mx-4"
        />
      </div>
    );
  }

  return (
    <div
      data-slot="meetings-table"
      className={cn("w-full", className)}
      {...props}
    >
      <Table aria-label="Meetings">
        <MeetingsTableHeader />
        <TableBody>
          {meetings.map((meeting, index) => (
            <MeetingRow
              key={meeting.id}
              ref={(node) => {
                rowRefs.current[index] = node;
              }}
              meeting={meeting}
              tabIndex={index === activeIndex ? 0 : -1}
              onView={onView}
              onRename={onRename}
              onDownload={onDownload}
              onDelete={onDelete}
              onKeyDown={(event) => handleRowKeyDown(event, index)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export { MeetingsTable };
export type { MeetingsTableProps };
