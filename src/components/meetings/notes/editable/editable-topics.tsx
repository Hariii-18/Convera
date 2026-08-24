import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DiscussionTopicData } from "@/components/meetings/summary/types";

type EditableTopicsProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  topics: DiscussionTopicData[];
  onChange: (topics: DiscussionTopicData[]) => void;
};

/** Editable Discussion Topics: a title plus an optional short description
 * per topic, arbitrary N topics. */
function EditableTopics({ className, topics, onChange, ...props }: EditableTopicsProps) {
  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Discussion Topics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {topics.map((topic, index) => (
            <div
              key={topic.id}
              className="flex flex-col gap-2 rounded-lg p-3 ring-1 ring-foreground/10"
            >
              <div className="flex items-start gap-2">
                <Input
                  value={topic.title}
                  placeholder="Topic title"
                  className="flex-1"
                  onChange={(event) => {
                    const next = [...topics];
                    next[index] = { ...topic, title: event.target.value };
                    onChange(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove topic"
                  onClick={() => onChange(topics.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </div>
              <Textarea
                value={topic.description ?? ""}
                placeholder="Description (optional)"
                rows={2}
                onChange={(event) => {
                  const next = [...topics];
                  next[index] = {
                    ...topic,
                    description: event.target.value || undefined,
                  };
                  onChange(next);
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              onChange([...topics, { id: crypto.randomUUID(), title: "", description: undefined }])
            }
          >
            <Plus data-icon="inline-start" />
            Add topic
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { EditableTopics };
export type { EditableTopicsProps };
