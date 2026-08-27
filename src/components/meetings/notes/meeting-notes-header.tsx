import * as React from "react";
import { CalendarClock, Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/components/meetings/format";
import { formatIstDisplay } from "@/components/meetings/notes/format";
import { cn } from "@/lib/utils";

type MeetingNotesHeaderProps = React.ComponentProps<"div"> & {
  title?: string;
  /** Backend-formatted IST string ("YYYY-MM-DD HH:MM:SS TZ"). Omit while notes aren't ready yet. */
  dateTimeIst?: string;
  durationSeconds?: number | null;
  loading?: boolean;
  /** Renders `title` as an editable input instead of static text. */
  editMode?: boolean;
  onTitleChange?: (title: string) => void;
};

/**
 * Document header for Meeting Notes: title, IST date/time, and duration.
 * Distinct from `WorkspaceHeader` — this is the self-contained header for
 * the notes document itself (the shape a future PDF/email export would
 * reuse), not the meeting workspace shell.
 */
function MeetingNotesHeader({
  className,
  title,
  dateTimeIst,
  durationSeconds,
  loading = false,
  editMode = false,
  onTitleChange,
  ...props
}: MeetingNotesHeaderProps) {
  return (
    <div
      data-slot="meeting-notes-header"
      className={cn(
        "flex flex-col gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : editMode ? (
        <>
          <Input
            value={title ?? ""}
            placeholder="Meeting title"
            aria-label="Meeting title"
            className="h-9 max-w-md text-lg font-semibold"
            onChange={(event) => onTitleChange?.(event.target.value)}
          />
          {dateTimeIst ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                {formatIstDisplay(dateTimeIst)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                {formatDuration(durationSeconds)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Date/time and duration will appear once this meeting&apos;s notes are ready.
            </p>
          )}
        </>
      ) : (
        <>
          <h2 className="truncate font-heading text-lg font-semibold text-foreground">
            {title}
          </h2>
          {dateTimeIst ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                {formatIstDisplay(dateTimeIst)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                {formatDuration(durationSeconds)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Date/time and duration will appear once this meeting&apos;s notes are ready.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export { MeetingNotesHeader };
export type { MeetingNotesHeaderProps };
