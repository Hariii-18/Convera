import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MeetingTag } from "@/components/meetings/info-panel/types";
import { cn } from "@/lib/utils";

type MeetingTagsProps = React.ComponentProps<"div"> & {
  tags?: MeetingTag[];
  loading?: boolean;
  /** Shown in place of the list when `tags` is empty. */
  emptyMessage?: string;
};

/**
 * Reusable inline tag list. Presentational only — rendering, not tag
 * management (no add/remove affordance).
 */
function MeetingTags({
  className,
  tags,
  loading = false,
  emptyMessage = "No tags yet",
  ...props
}: MeetingTagsProps) {
  return (
    <div
      data-slot="meeting-tags"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      {...props}
    >
      {loading ? (
        <>
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </>
      ) : !tags || tags.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <li key={tag.id}>
              <Badge variant="secondary">{tag.label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { MeetingTags };
export type { MeetingTagsProps };
