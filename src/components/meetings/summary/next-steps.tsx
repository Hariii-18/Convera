import * as React from "react";
import { ArrowRight, ListTodo } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { NextStepData } from "@/components/meetings/summary/types";

type NextStepsProps = React.ComponentProps<"div"> & {
  steps?: NextStepData[];
  loading?: boolean;
};

/**
 * What happens after this meeting. Renders exactly what's passed in `steps`.
 */
function NextSteps({
  className,
  steps = [],
  loading = false,
  ...props
}: NextStepsProps) {
  return (
    <Card data-slot="next-steps" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Next Steps</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        ) : steps.length === 0 ? (
          <EmptyState
            icon={<ListTodo />}
            title="No next steps yet"
            description="What happens after this meeting will appear here."
          />
        ) : (
          <ol role="list" className="flex flex-col gap-3">
            {steps.map((step) => (
              <li key={step.id} className="flex items-start gap-2.5">
                <ArrowRight
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <p className="text-sm text-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export { NextSteps };
export type { NextStepsProps };
