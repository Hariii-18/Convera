"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionItemStatusConfig } from "@/components/meetings/summary/action-item-status";
import type {
  ActionItemData,
  ActionItemStatus,
} from "@/components/meetings/summary/types";

/** What gets persisted on Save. `null` clears the field — never inferred or
 * defaulted (e.g. an unselected status stays `null`, not "not-started"). */
export type ActionItemEdits = {
  text: string;
  owner: string | null;
  dueDate: string | null;
  status: ActionItemStatus | null;
};

const UNSET_STATUS = "unset";

type EditActionItemDialogProps = {
  item: ActionItemData | null;
  onOpenChange: (open: boolean) => void;
  onSave: (edits: ActionItemEdits) => void;
  isPending?: boolean;
};

/**
 * Edits an action item's task/owner/due date/status. Controlled by `item`
 * (rendering one opens the dialog, `null` closes it), mirroring
 * `RenameMeetingDialog`. Due date is a free-text field, not a date picker —
 * the backend stores it as an unconstrained string, so this never imposes a
 * format the AI-generated value might not already be in.
 */
function EditActionItemDialog({
  item,
  onOpenChange,
  onSave,
  isPending = false,
}: EditActionItemDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent data-slot="edit-action-item-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit action item</DialogTitle>
          <DialogDescription>
            Changes are saved to this meeting and survive a reload.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <EditActionItemForm
            key={item.id}
            item={item}
            onSave={onSave}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type EditActionItemFormProps = {
  item: ActionItemData;
  onSave: (edits: ActionItemEdits) => void;
  isPending: boolean;
};

function EditActionItemForm({ item, onSave, isPending }: EditActionItemFormProps) {
  const [text, setText] = React.useState(item.text);
  const [owner, setOwner] = React.useState(item.assignee?.name ?? "");
  const [dueDate, setDueDate] = React.useState(
    typeof item.dueDate === "string" ? item.dueDate : "",
  );
  const [status, setStatus] = React.useState<string>(item.status ?? UNSET_STATUS);

  const trimmedText = text.trim();
  const canSave = trimmedText.length > 0 && !isPending;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="action-item-text"
            className="text-sm font-medium text-foreground"
          >
            Task
          </label>
          <Input
            id="action-item-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="action-item-owner"
            className="text-sm font-medium text-foreground"
          >
            Owner
          </label>
          <Input
            id="action-item-owner"
            value={owner}
            placeholder="Unassigned"
            onChange={(event) => setOwner(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="action-item-due-date"
            className="text-sm font-medium text-foreground"
          >
            Due date
          </label>
          <Input
            id="action-item-due-date"
            value={dueDate}
            placeholder="e.g. 2026-09-01"
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Status</span>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as string)}
          >
            <SelectTrigger aria-label="Status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET_STATUS}>No status</SelectItem>
              {(Object.keys(actionItemStatusConfig) as ActionItemStatus[]).map(
                (value) => (
                  <SelectItem key={value} value={value}>
                    {actionItemStatusConfig[value].label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button
          className="w-full sm:w-auto"
          disabled={!canSave}
          onClick={() =>
            onSave({
              text: trimmedText,
              owner: owner.trim() ? owner.trim() : null,
              dueDate: dueDate.trim() ? dueDate.trim() : null,
              status: status === UNSET_STATUS ? null : (status as ActionItemStatus),
            })
          }
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

export { EditActionItemDialog };
export type { EditActionItemDialogProps };
