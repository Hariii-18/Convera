import * as React from "react";
import { MessagesSquare } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { formatTimestamp } from "@/components/meetings/format";
import { cn } from "@/lib/utils";
import type { MeetingNotesSegmentData } from "@/components/meetings/notes/types";

type EditableDetailedDiscussionProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  segments: MeetingNotesSegmentData[];
  onChange: (segments: MeetingNotesSegmentData[]) => void;
};

/**
 * Editable Detailed Discussion: only a segment's text can be changed —
 * timestamps come from the transcript and are never user-editable, and no
 * segments can be added or removed (there's nothing to invent them from).
 */
function EditableDetailedDiscussion({
  className,
  segments,
  onChange,
  ...props
}: EditableDetailedDiscussionProps) {
  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Detailed Discussion</CardTitle>
      </CardHeader>
      <CardContent>
        {segments.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare />}
            title="No detailed discussion yet"
            description="Timestamped discussion segments will appear here once this meeting is transcribed."
          />
        ) : (
          <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto">
            {segments.map((segment, index) => (
              <div key={segment.id} className="flex items-start gap-2">
                <span className="mt-2 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatTimestamp(segment.start)}
                </span>
                <Textarea
                  value={segment.text}
                  rows={2}
                  className="flex-1"
                  onChange={(event) => {
                    const next = [...segments];
                    next[index] = { ...segment, text: event.target.value };
                    onChange(next);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { EditableDetailedDiscussion };
export type { EditableDetailedDiscussionProps };
