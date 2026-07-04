import * as React from "react";
import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ExecutiveSummaryProps = React.ComponentProps<"div"> & {
  /** Full recap text, rendered verbatim — never generated or truncated here. */
  summary?: string;
  loading?: boolean;
};

/**
 * High-level recap at the top of the meeting summary. Renders whatever
 * `summary` is passed — no fabricated copy.
 */
function ExecutiveSummary({
  className,
  summary,
  loading = false,
  ...props
}: ExecutiveSummaryProps) {
  return (
    <Card data-slot="executive-summary" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Executive Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : !summary ? (
          <EmptyState
            icon={<Sparkles />}
            title="No executive summary yet"
            description="A high-level recap of this meeting will appear here once it's been processed."
          />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {summary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export { ExecutiveSummary };
export type { ExecutiveSummaryProps };
