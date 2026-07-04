import * as React from "react";
import {
  Archive,
  CalendarDays,
  Clock,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MeetingStatusBadge } from "@/components/meetings/meeting-status-badge";
import { formatDate, formatDuration } from "@/components/meetings/format";
import type { MeetingStatus } from "@/components/meetings/types";
import { cn } from "@/lib/utils";

type WorkspaceHeaderProps = React.ComponentProps<"div"> & {
  title: string;
  /** Heading level for `title`. Defaults to `h1`; pass `h2` when nested under another page heading (e.g. a style guide demo). */
  titleAs?: "h1" | "h2" | "h3";
  status: MeetingStatus;
  /** Total length in seconds. Omit or null while duration is unknown (e.g. still processing). */
  durationSeconds?: number | null;
  createdAt: string | Date;
  /** Presentational only — the caller owns what exporting actually does. */
  onExport?: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
};

/**
 * Header for the meeting workspace shell: title, status, key metadata, and
 * primary actions. Fields mirror the `Meeting` domain type so a real page can
 * pass one straight through; nothing here fetches or fabricates data.
 */
function WorkspaceHeader({
  className,
  title,
  titleAs: Heading = "h1",
  status,
  durationSeconds,
  createdAt,
  onExport,
  onRename,
  onDuplicate,
  onArchive,
  onDelete,
  ...props
}: WorkspaceHeaderProps) {
  return (
    <div
      data-slot="workspace-header"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Heading className="min-w-0 truncate font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </Heading>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download data-icon="inline-start" />
            Export
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="More actions"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRename}>
                <Pencil />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                <Archive />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <MeetingStatusBadge status={status} />
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          {formatDuration(durationSeconds)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          Created {formatDate(createdAt)}
        </span>
      </div>
    </div>
  );
}

export { WorkspaceHeader };
export type { WorkspaceHeaderProps };
