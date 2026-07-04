import * as React from "react";
import { ChevronRight, Video } from "lucide-react";

import { TableCell, TableRow } from "@/components/ui/table";
import { MeetingContextMenu } from "@/components/meetings/meeting-context-menu";
import { MeetingStatusBadge } from "@/components/meetings/meeting-status-badge";
import { meetingStatusConfig } from "@/components/meetings/meeting-status";
import {
  formatDateTime,
  formatDuration,
  formatDate,
  formatRelativeTime,
} from "@/components/meetings/format";
import type { Meeting } from "@/components/meetings/types";

type MeetingRowProps = {
  meeting: Meeting;
  tabIndex: number;
  onView?: (meeting: Meeting) => void;
  onRename?: (meeting: Meeting) => void;
  onDownload?: (meeting: Meeting) => void;
  onDelete?: (meeting: Meeting) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTableRowElement>) => void;
};

const MeetingRow = React.forwardRef<HTMLTableRowElement, MeetingRowProps>(
  function MeetingRow(
    { meeting, tabIndex, onView, onRename, onDownload, onDelete, onKeyDown },
    ref,
  ) {
    const accessibleLabel = `${meeting.title}, ${meetingStatusConfig[meeting.status].label}, duration ${formatDuration(meeting.durationSeconds)}${
      meeting.participantCount !== undefined
        ? `, ${meeting.participantCount} ${meeting.participantCount === 1 ? "participant" : "participants"}`
        : ""
    }, created ${formatDate(meeting.createdAt)}, updated ${formatRelativeTime(meeting.updatedAt)}`;

    return (
      <TableRow
        ref={ref}
        tabIndex={tabIndex}
        aria-label={accessibleLabel}
        data-slot="meeting-row"
        className="group cursor-pointer outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
        onClick={() => onView?.(meeting)}
        onKeyDown={(event) => {
          if (
            (event.key === "Enter" || event.key === " ") &&
            event.target === event.currentTarget
          ) {
            event.preventDefault();
            onView?.(meeting);
          }
          onKeyDown?.(event);
        }}
      >
        <TableCell className="py-3 pl-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Video className="size-4" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {meeting.title}
              </span>
              {meeting.participantCount !== undefined && (
                <span className="truncate text-xs text-muted-foreground">
                  {meeting.participantCount}{" "}
                  {meeting.participantCount === 1 ? "participant" : "participants"}
                </span>
              )}
            </div>
          </div>
        </TableCell>

        <TableCell className="w-px whitespace-nowrap">
          <MeetingStatusBadge status={meeting.status} />
        </TableCell>

        <TableCell className="w-px whitespace-nowrap tabular-nums text-muted-foreground">
          {formatDuration(meeting.durationSeconds)}
        </TableCell>

        <TableCell className="w-px whitespace-nowrap text-muted-foreground">
          {formatDate(meeting.createdAt)}
        </TableCell>

        <TableCell
          className="w-px whitespace-nowrap text-muted-foreground"
          title={formatDateTime(meeting.updatedAt)}
        >
          {formatRelativeTime(meeting.updatedAt)}
        </TableCell>

        <TableCell className="w-px whitespace-nowrap pr-4">
          <div
            className="flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <ChevronRight
              className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
            <MeetingContextMenu
              meeting={meeting}
              onView={onView}
              onRename={onRename}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          </div>
        </TableCell>
      </TableRow>
    );
  },
);

export { MeetingRow };
