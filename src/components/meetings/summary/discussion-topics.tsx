import * as React from "react";
import { MessagesSquare } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DiscussionTopicData } from "@/components/meetings/summary/types";

type DiscussionTopicsProps = React.ComponentProps<"div"> & {
  topics?: DiscussionTopicData[];
  loading?: boolean;
};

/**
 * Topics raised during the meeting: a title and an optional short
 * description each. Renders exactly what's passed in `topics`.
 */
function DiscussionTopics({
  className,
  topics = [],
  loading = false,
  ...props
}: DiscussionTopicsProps) {
  return (
    <Card data-slot="discussion-topics" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Discussion Topics</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare />}
            title="No discussion topics yet"
            description="Topics covered in this meeting will appear here."
          />
        ) : (
          <ol role="list" className="flex flex-col gap-4">
            {topics.map((topic) => (
              <li key={topic.id}>
                <p className="text-sm font-medium text-foreground">
                  {topic.title}
                </p>
                {topic.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {topic.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export { DiscussionTopics };
export type { DiscussionTopicsProps };
