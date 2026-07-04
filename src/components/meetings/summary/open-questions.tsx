import * as React from "react";
import { CircleHelp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { OpenQuestionData } from "@/components/meetings/summary/types";

type OpenQuestionsProps = React.ComponentProps<"div"> & {
  questions?: OpenQuestionData[];
  loading?: boolean;
};

/**
 * Unresolved questions surfaced during the meeting. Renders exactly what's
 * passed in `questions`.
 */
function OpenQuestions({
  className,
  questions = [],
  loading = false,
  ...props
}: OpenQuestionsProps) {
  return (
    <Card data-slot="open-questions" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Open Questions</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <EmptyState
            icon={<CircleHelp />}
            title="No open questions"
            description="Unresolved questions from this meeting will appear here."
          />
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            {questions.map((question) => (
              <li key={question.id} className="flex items-start gap-2.5">
                <CircleHelp
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-info"
                />
                <p className="text-sm text-foreground">{question.text}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { OpenQuestions };
export type { OpenQuestionsProps };
