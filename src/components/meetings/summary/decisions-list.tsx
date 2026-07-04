import * as React from "react";
import { CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/components/meetings/format";
import { cn } from "@/lib/utils";
import type { DecisionData } from "@/components/meetings/summary/types";

type DecisionsListProps = React.ComponentProps<"div"> & {
  decisions?: DecisionData[];
  loading?: boolean;
};

/**
 * Bullet list of decisions made during the meeting, each with an optional
 * timestamp. Renders exactly what's passed in `decisions`.
 */
function DecisionsList({
  className,
  decisions = [],
  loading = false,
  ...props
}: DecisionsListProps) {
  return (
    <Card data-slot="decisions-list" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Decisions</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 />}
            title="No decisions recorded yet"
            description="Decisions made during this meeting will appear here."
          />
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            {decisions.map((decision) => (
              <li key={decision.id} className="flex items-start gap-2.5">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-success"
                />
                <p className="text-sm text-foreground">
                  {decision.text}
                  {decision.timestampSeconds !== undefined && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground tabular-nums">
                      {formatTimestamp(decision.timestampSeconds)}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { DecisionsList };
export type { DecisionsListProps };
