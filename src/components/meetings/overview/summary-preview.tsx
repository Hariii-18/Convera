import * as React from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SummaryPreviewProps = React.ComponentProps<"div"> & {
  /** Full summary text — this component only ever shows the first few lines of it. */
  summary?: string;
  loading?: boolean;
  onViewFullSummary?: () => void;
};

/**
 * Three-line clamp of the meeting summary with a link to the full Summary
 * tab. Never generates or fabricates copy — `summary` is shown verbatim.
 */
function SummaryPreview({
  className,
  summary,
  loading = false,
  onViewFullSummary,
  ...props
}: SummaryPreviewProps) {
  return (
    <Card data-slot="summary-preview" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Summary</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewFullSummary}
            disabled={!onViewFullSummary}
          >
            View full summary
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : !summary ? (
          <EmptyState
            icon={<Sparkles />}
            title="No summary yet"
            description="A summary will appear here once this meeting has been processed."
          />
        ) : (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {summary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export { SummaryPreview };
export type { SummaryPreviewProps };
