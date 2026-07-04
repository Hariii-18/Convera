import * as React from "react";

import { cn } from "@/lib/utils";

type TimelineMarkerProps = React.ComponentProps<"div"> & {
  /** Hides the connecting line below the dot for the final item. */
  isLast?: boolean;
};

/**
 * The dot-and-line marker for one timeline entry. Purely decorative — the
 * surrounding `TimelineItem` owns the actual content and interaction.
 */
function TimelineMarker({
  className,
  isLast = false,
  ...props
}: TimelineMarkerProps) {
  return (
    <div
      data-slot="timeline-marker"
      aria-hidden="true"
      className={cn(
        "flex w-4 shrink-0 flex-col items-center self-stretch",
        className,
      )}
      {...props}
    >
      <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/15" />
      {!isLast && <span className="mt-1.5 w-px flex-1 bg-border" />}
    </div>
  );
}

export { TimelineMarker };
export type { TimelineMarkerProps };
