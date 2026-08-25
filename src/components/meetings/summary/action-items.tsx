import * as React from "react";
import { CalendarDays, ListChecks, Pencil } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/components/meetings/format";
import { actionItemStatusConfig } from "@/components/meetings/summary/action-item-status";
import {
  EditActionItemDialog,
  type ActionItemEdits,
} from "@/components/meetings/summary/edit-action-item-dialog";
import { cn } from "@/lib/utils";
import type { ActionItemData } from "@/components/meetings/summary/types";

type ActionItemsProps = React.ComponentProps<"div"> & {
  items?: ActionItemData[];
  loading?: boolean;
  /** Controlled — the caller owns whether toggling changes `status`. */
  onToggleActionItem?: (id: string) => void;
  /** Controlled — the caller owns persisting text/owner/due date/status
   * edits made through the per-item edit dialog. Omit to hide the edit
   * affordance entirely. */
  onSaveActionItem?: (id: string, edits: ActionItemEdits) => void;
  /** Id of the item currently being saved (toggle or edit), if any —
   * disables that item's controls and shows a "Saving…" indicator. */
  pendingItemId?: string | null;
};

/**
 * Follow-up tasks captured during the meeting: a checkbox (checked when
 * `status` is "completed"), optional assignee and due date, and a status
 * badge — shown only when `status` is set, since it's never inferred (e.g.
 * defaulted to "not started") for an item the transcript didn't state a
 * status for. Toggling the checkbox only calls back — this component holds
 * no completion state of its own.
 */
function ActionItems({
  className,
  items = [],
  loading = false,
  onToggleActionItem,
  onSaveActionItem,
  pendingItemId = null,
  ...props
}: ActionItemsProps) {
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const editingItem = items.find((item) => item.id === editingItemId) ?? null;

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
              const statusConfig = item.status
                ? actionItemStatusConfig[item.status]
                : undefined;
              const checkboxId = `action-item-${item.id}`;
              const metaId = `action-item-meta-${item.id}`;
              const hasMeta = Boolean(item.assignee || item.dueDate);
              const isPending = pendingItemId === item.id;

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start gap-x-3 gap-y-2"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    disabled={!onToggleActionItem || isPending}
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

                    {(hasMeta || isPending) && (
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
                        {isPending && <span>Saving…</span>}
                      </div>
                    )}
                  </div>

                  {statusConfig && (
                    <StatusBadge status={statusConfig.badgeStatus}>
                      {statusConfig.label}
                    </StatusBadge>
                  )}

                  {onSaveActionItem && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit action item"
                      disabled={isPending}
                      onClick={() => setEditingItemId(item.id)}
                    >
                      <Pencil />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {onSaveActionItem && (
        <EditActionItemDialog
          item={editingItem}
          isPending={editingItem ? pendingItemId === editingItem.id : false}
          onOpenChange={(open) => {
            if (!open) setEditingItemId(null);
          }}
          onSave={(edits) => {
            if (!editingItem) return;
            onSaveActionItem(editingItem.id, edits);
            setEditingItemId(null);
          }}
        />
      )}
    </Card>
  );
}

export { ActionItems };
export type { ActionItemsProps };
