import * as React from "react";

import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/components/meetings/format";

type TimestampProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** Seconds from the start of the meeting. */
  seconds: number;
};

/**
 * Displays a transcript position as "mm:ss" (or "h:mm:ss"). Clicking only
 * calls back to the caller — it never seeks or plays anything itself.
 */
function Timestamp({ seconds, className, onClick, ...props }: TimestampProps) {
  const label = formatTimestamp(seconds);

  if (!onClick) {
    return (
      <span
        data-slot="transcript-timestamp"
        className={cn(
          "shrink-0 font-mono text-xs tabular-nums text-muted-foreground",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-slot="transcript-timestamp"
      onClick={onClick}
      aria-label={`Jump to ${label}`}
      className={cn(
        "shrink-0 cursor-pointer rounded-sm font-mono text-xs tabular-nums text-muted-foreground outline-none transition-colors hover:text-foreground hover:underline",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {label}
    </button>
  );
}

export { Timestamp };
export type { TimestampProps };
