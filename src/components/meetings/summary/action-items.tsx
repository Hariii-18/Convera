import * as React from "react";
import { CalendarDays, ListChecks } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/components/meetings/format";
import { actionItemStatusConfig } from "@/components/meetings/summary/action-item-status";
import { cn } from "@/lib/utils";
import type { ActionItemData } from "@/components/meetings/summary/types";

type ActionItemsProps = React.ComponentProps<"div"> & {
  items?: ActionItemData[];
  loading?: boolean;
  /** Controlled — the caller owns whether toggling changes `status`. */
  onToggleActionItem?: (id: string) => void;
};

/**
 * Follow-up tasks captured during the meeting: a checkbox (checked when
 * `status` is "completed"), optional assignee and due date, and a status
 * badge. Toggling the checkbox only calls back — this component holds no
 * completion state of its own.
 */
function ActionItems({
  className,
  items = [],
  loading = false,
  onToggleActionItem,
  ...props
}: ActionItemsProps) {
  return (
    <Card data-slot="action-items" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Action Items</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-4 shrink-0 rounded-[4px]" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
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
              const checked = item.status === "completed";
              const statusConfig = actionItemStatusConfig[item.status];
              const checkboxId = `action-item-${item.id}`;
              const metaId = `action-item-meta-${item.id}`;
              const hasMeta = Boolean(item.assignee || item.dueDate);

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start gap-x-3 gap-y-2"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    disabled={!onToggleActionItem}
                    onCheckedChange={() => onToggleActionItem?.(item.id)}
                    aria-describedby={hasMeta ? metaId : undefined}
                    className="mt-0.5"
                  />

                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={checkboxId}
                      className={cn(
                        "text-sm text-foreground",
                        !onToggleActionItem && "cursor-default",
                        checked && "text-muted-foreground line-through",
                      )}
                    >
                      {item.text}
                    </label>

                    {hasMeta && (
                      <div
                        id={metaId}
                        className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
                      >
                        {item.assignee && (
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar size="sm">
                              <AvatarFallback>
                                {item.assignee.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {item.assignee.name}
                          </span>
                        )}
                        {item.dueDate && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays
                              aria-hidden="true"
                              className="size-3.5"
                            />
                            {formatDate(item.dueDate)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <StatusBadge status={statusConfig.badgeStatus}>
                    {statusConfig.label}
                  </StatusBadge>
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
