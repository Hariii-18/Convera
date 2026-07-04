import * as React from "react";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type AIInsightsPlaceholderProps = React.ComponentProps<"div">;

/**
 * Placeholder for a future AI insights section (themes, sentiment, smart
 * highlights). Renders no data and wires up no generation — a static card
 * announcing what's coming.
 */
function AIInsightsPlaceholder({
  className,
  ...props
}: AIInsightsPlaceholderProps) {
  return (
    <Card data-slot="ai-insights-placeholder" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">AI insights</CardTitle>
        <CardAction>
          <Badge variant="secondary">Coming soon</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={<Sparkles />}
          title="AI insights are on the way"
          description="Key themes, sentiment, and smart highlights will appear here once available."
        />
      </CardContent>
    </Card>
  );
}

export { AIInsightsPlaceholder };
export type { AIInsightsPlaceholderProps };
