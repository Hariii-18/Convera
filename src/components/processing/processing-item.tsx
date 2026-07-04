import * as React from "react";

import { ProcessingProgress } from "@/components/processing/processing-progress";
import { ProcessingStatus } from "@/components/processing/processing-status";
import { processingStageConfig } from "@/components/processing/processing-stage";
import { formatElapsed } from "@/components/processing/format";
import { cn } from "@/lib/utils";
import type { ProcessingQueueItem } from "@/components/processing/types";

type ProcessingItemProps = React.ComponentProps<"li"> & {
  item: ProcessingQueueItem;
};

function ProcessingItem({ item, className, ...props }: ProcessingItemProps) {
  const {
    title,
    stage,
    percentage,
    elapsedSeconds,
    currentOperation,
    errorMessage,
  } = item;
  const { label: stageLabel, icon: StageIcon } = processingStageConfig[stage];
  const elapsedLabel = formatElapsed(elapsedSeconds);
  const helperText = stage === "failed" ? errorMessage : currentOperation;

  const accessibleLabel = `${title}, ${stageLabel}${
    percentage !== undefined ? `, ${Math.round(percentage)} percent` : ""
  }, ${elapsedLabel} elapsed${helperText ? `, ${helperText}` : ""}`;

  return (
    <li
      data-slot="processing-item"
      aria-label={accessibleLabel}
      className={cn("flex flex-col gap-3 px-4 py-4", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              stage === "completed" && "bg-success/10 text-success",
              stage === "failed" && "bg-destructive/10 text-destructive",
              stage !== "completed" &&
                stage !== "failed" &&
                "bg-info/10 text-info",
            )}
          >
            <StageIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <p
              className="truncate text-sm font-medium text-foreground"
              title={title}
            >
              {title}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{stageLabel}</span>
              <span aria-hidden="true">&middot;</span>
              <span className="tabular-nums">{elapsedLabel} elapsed</span>
            </p>
          </div>
        </div>
        <ProcessingStatus stage={stage} className="shrink-0" />
      </div>

      <ProcessingProgress percentage={percentage} label={stageLabel} />

      {helperText && (
        <p
          className={cn(
            "truncate text-xs",
            stage === "failed" ? "text-destructive" : "text-muted-foreground",
          )}
          title={helperText}
        >
          {helperText}
        </p>
      )}
    </li>
  );
}

export { ProcessingItem };
export type { ProcessingItemProps };
