import * as React from "react";

import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/components/meetings/format";

type TimestampProps = React.ComponentProps<"span"> & {
  /** Seconds from the start of the meeting. */
  seconds: number;
};

/**
 * Displays a timeline position as "mm:ss" (or "h:mm:ss"). Purely a label —
 * it never seeks or plays anything, per the timeline's "no transcript
 * seeking" rule.
 */
function Timestamp({ seconds, className, ...props }: TimestampProps) {
  return (
    <span
      data-slot="timeline-timestamp"
      className={cn(
        "shrink-0 font-mono text-xs text-muted-foreground tabular-nums",
        className,
      )}
      {...props}
    >
      {formatTimestamp(seconds)}
    </span>
  );
}

export { Timestamp };
export type { TimestampProps };
