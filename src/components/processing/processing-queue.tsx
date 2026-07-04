import * as React from "react";
import { ListChecks } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ProcessingItem } from "@/components/processing/processing-item";
import { ProcessingQueueSkeleton } from "@/components/processing/processing-queue-skeleton";
import { cn } from "@/lib/utils";
import type { ProcessingQueueItem } from "@/components/processing/types";

type ProcessingQueueProps = React.ComponentProps<"div"> & {
  items?: ProcessingQueueItem[];
  isLoading?: boolean;
  skeletonCount?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
};

/**
 * Renders whatever `items` is passed once a processing queue exists.
 * Purely presentational: it never fetches or fabricates data, so callers own
 * loading/empty state by passing `items` and `isLoading`.
 */
function ProcessingQueue({
  items = [],
  isLoading = false,
  skeletonCount = 3,
  emptyTitle = "Nothing processing",
  emptyDescription = "Meetings being transcribed or summarized will show up here.",
  emptyAction,
  className,
  ...props
}: ProcessingQueueProps) {
  if (isLoading) {
    return (
      <div
        data-slot="processing-queue"
        className={cn("w-full", className)}
        {...props}
      >
        <span role="status" className="sr-only">
          Loading processing queue&hellip;
        </span>
        <ProcessingQueueSkeleton count={skeletonCount} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        data-slot="processing-queue"
        className={cn("w-full", className)}
        {...props}
      >
        <EmptyState
          icon={<ListChecks />}
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
      data-slot="processing-queue"
      className={cn("w-full", className)}
      {...props}
    >
      <ul role="list" className="flex flex-col divide-y divide-border">
        {items.map((item) => (
          <ProcessingItem key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

export { ProcessingQueue };
export type { ProcessingQueueProps };
