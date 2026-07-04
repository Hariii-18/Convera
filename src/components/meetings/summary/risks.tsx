import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { RiskData } from "@/components/meetings/summary/types";

type RisksProps = React.ComponentProps<"div"> & {
  risks?: RiskData[];
  loading?: boolean;
};

/**
 * Risks or concerns flagged during the meeting. Renders exactly what's
 * passed in `risks`.
 */
function Risks({
  className,
  risks = [],
  loading = false,
  ...props
}: RisksProps) {
  return (
    <Card data-slot="risks" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Risks</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        ) : risks.length === 0 ? (
          <EmptyState
            icon={<TriangleAlert />}
            title="No risks flagged"
            description="Risks or concerns raised in this meeting will appear here."
          />
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            {risks.map((risk) => (
              <li key={risk.id} className="flex items-start gap-2.5">
                <TriangleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-warning"
                />
                <p className="text-sm text-foreground">{risk.text}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { Risks };
export type { RisksProps };
