import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type EditableTextItem = { id: string; text: string };

type EditableTextListProps<T extends EditableTextItem> = Omit<
  React.ComponentProps<"div">,
  "onChange"
> & {
  heading: string;
  items: T[];
  onChange: (items: T[]) => void;
  addLabel: string;
  placeholder?: string;
  makeItem: () => T;
};

/**
 * Editable N-item text list — the shared editor behind Decisions, Risks /
 * Blockers, Open Questions, and Next Steps, which are all just a title plus
 * a flat list of `{ text }` items. Discussion Topics and Action Items have
 * extra fields per item and get their own editors instead of reusing this.
 */
function EditableTextList<T extends EditableTextItem>({
  className,
  heading,
  items,
  onChange,
  addLabel,
  placeholder,
  makeItem,
  ...props
}: EditableTextListProps<T>) {
  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">{heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-start gap-2">
              <Textarea
                value={item.text}
                placeholder={placeholder}
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
                aria-label="Remove item"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <X />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onChange([...items, makeItem()])}
          >
            <Plus data-icon="inline-start" />
            {addLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { EditableTextList };
export type { EditableTextListProps, EditableTextItem };
