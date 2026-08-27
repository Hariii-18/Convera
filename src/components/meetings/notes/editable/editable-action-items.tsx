import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MeetingNotesActionItemData } from "@/components/meetings/notes/types";

type EditableActionItemsProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  items: MeetingNotesActionItemData[];
  onChange: (items: MeetingNotesActionItemData[]) => void;
};

/** Editable Action Items: arbitrary N items, each with text plus an
 * optional owner and due date — never inferred, left blank unless the user
 * types one in. */
function EditableActionItems({ className, items, onChange, ...props }: EditableActionItemsProps) {
  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">
          Action Items{items.length > 0 ? ` (${items.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-lg p-3 ring-1 ring-foreground/10"
            >
              <div className="flex items-start gap-2">
                <Textarea
                  value={item.text}
                  placeholder="Action item"
                  rows={1}
                  className="min-h-9 flex-1"
                  onChange={(event) => {
                    const next = [...items];
                    next[index] = { ...item, text: event.target.value };
                    onChange(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove action item"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={item.owner ?? ""}
                  placeholder="Owner (optional)"
                  className="w-40"
                  onChange={(event) => {
                    const next = [...items];
                    next[index] = { ...item, owner: event.target.value || undefined };
                    onChange(next);
                  }}
                />
                <Input
                  value={item.dueDate ?? ""}
                  placeholder="Due date (optional)"
                  className="w-40"
                  onChange={(event) => {
                    const next = [...items];
                    next[index] = { ...item, dueDate: event.target.value || undefined };
                    onChange(next);
                  }}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onChange([...items, { id: crypto.randomUUID(), text: "" }])}
          >
            <Plus data-icon="inline-start" />
            Add action item
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { EditableActionItems };
export type { EditableActionItemsProps };
