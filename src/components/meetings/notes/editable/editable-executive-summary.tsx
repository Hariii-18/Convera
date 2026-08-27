import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type EditableExecutiveSummaryProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  summary: string;
  onChange: (summary: string) => void;
};

function EditableExecutiveSummary({
  className,
  summary,
  onChange,
  ...props
}: EditableExecutiveSummaryProps) {
  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Executive Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={summary}
          placeholder="High-level recap of this meeting"
          rows={5}
          onChange={(event) => onChange(event.target.value)}
        />
      </CardContent>
    </Card>
  );
}

export { EditableExecutiveSummary };
export type { EditableExecutiveSummaryProps };
