import * as React from "react";
import { CalendarDays, ListChecks, User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatActionItemDueDate } from "@/components/meetings/notes/format";
import { cn } from "@/lib/utils";
import type { MeetingNotesActionItemData } from "@/components/meetings/notes/types";

type ActionItemsProps = React.ComponentProps<"div"> & {
  items?: MeetingNotesActionItemData[];
  loading?: boolean;
};

/**
 * Follow-up tasks captured in the meeting summary. Owner and due date each
 * render only when the summary recorded one — nothing here tracks
 * completion status yet, so no status badge is shown or inferred (unlike
 * the editable Summary tab's Action Items).
 */
function ActionItems({
  className,
  items = [],
  loading = false,
  ...props
}: ActionItemsProps) {
  return (
    <Card data-slot="meeting-notes-action-items" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">
          Action Items{items.length > 0 ? ` (${items.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3.5 w-1/3" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ListChecks />}
            title="No action items yet"
            description="Follow-up tasks from this meeting will appear here."
          />
        ) : (
          <ul role="list" className="flex flex-col gap-4">
            {items.map((item) => {
              const hasMeta = Boolean(item.owner || item.dueDate);

              return (
                <li key={item.id} className="flex flex-col gap-1.5">
                  <p className="text-sm text-foreground">{item.text}</p>

                  {hasMeta && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {item.owner && (
                        <span className="inline-flex items-center gap-1">
                          <User aria-hidden="true" className="size-3.5" />
                          {item.owner}
                        </span>
                      )}
                      {item.dueDate && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays aria-hidden="true" className="size-3.5" />
                          {formatActionItemDueDate(item.dueDate)}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { ActionItems };
export type { ActionItemsProps };
