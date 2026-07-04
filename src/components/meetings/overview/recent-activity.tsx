import * as React from "react";
import { History } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/components/meetings/format";
import { activityTypeConfig } from "@/components/meetings/overview/activity-type";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/components/meetings/overview/types";

type RecentActivityProps = React.ComponentProps<"div"> & {
  items?: ActivityItem[];
  loading?: boolean;
  /** Number of leading entries to show. Defaults to 5. */
  maxItems?: number;
};

/**
 * Chronological feed of what's happened to this meeting (processing,
 * transcript edits, summary generation). Renders whatever `items` is
 * passed — it never fetches or fabricates entries.
 */
function RecentActivity({
  className,
  items,
  loading = false,
  maxItems = 5,
  ...props
}: RecentActivityProps) {
  const visibleItems = items?.slice(0, maxItems) ?? [];

  return (
    <Card data-slot="recent-activity" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyState
            icon={<History />}
            title="No activity yet"
            description="Actions taken on this meeting will show up here."
          />
        ) : (
          <ul role="list" className="flex flex-col gap-4">
            {visibleItems.map((item) => {
              const config = activityTypeConfig[item.type];
              const Icon = config.icon;

              return (
                <li key={item.id} className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium text-foreground">
                      {item.description ?? config.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.timestamp)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { RecentActivity };
export type { RecentActivityProps };
