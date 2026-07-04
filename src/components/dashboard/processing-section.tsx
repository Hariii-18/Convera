import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessingQueue } from "@/components/processing/processing-queue";
import { cn } from "@/lib/utils";
import type { ProcessingQueueItem } from "@/components/processing/types";

type ProcessingSectionProps = React.ComponentProps<"div"> & {
  items?: ProcessingQueueItem[];
  isLoading?: boolean;
};

/**
 * Renders whatever `items` is passed once a processing queue exists.
 * With none provided, ProcessingQueue shows its empty state instead of
 * fabricating rows.
 */
function ProcessingSection({
  className,
  items = [],
  isLoading = false,
  ...props
}: ProcessingSectionProps) {
  return (
    <div data-slot="processing-section" className={cn(className)} {...props}>
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle as="h2">Processing</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ProcessingQueue items={items} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}

export { ProcessingSection };
