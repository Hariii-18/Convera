import { Progress, ProgressLabel } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ProcessingProgressProps = {
  /** 0-100. Omit to render an indeterminate bar for stages with no measurable progress. */
  percentage?: number;
  /** Accessible name for the bar, e.g. the current stage label ("Transcribing"). */
  label: string;
  className?: string;
};

/** Progress bar + percentage readout, built on the shared Progress primitive. */
function ProcessingProgress({
  percentage,
  label,
  className,
}: ProcessingProgressProps) {
  const isIndeterminate = percentage === undefined;
  const clamped = isIndeterminate
    ? undefined
    : Math.min(100, Math.max(0, Math.round(percentage)));

  return (
    <Progress
      value={clamped === undefined ? null : clamped / 100}
      min={0}
      max={1}
      format={{ style: "percent", maximumFractionDigits: 0 }}
      className={cn(
        "flex-nowrap items-center gap-3 *:data-[slot=progress-track]:min-w-0 *:data-[slot=progress-track]:flex-1",
        className,
      )}
    >
      <ProgressLabel className="sr-only">{label} progress</ProgressLabel>
      <span
        aria-hidden="true"
        className="order-last w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
      >
        {isIndeterminate ? "—" : `${clamped}%`}
      </span>
    </Progress>
  );
}

export { ProcessingProgress };
