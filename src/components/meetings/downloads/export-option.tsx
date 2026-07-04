import * as React from "react";

import { exportFormatConfig } from "@/components/meetings/downloads/export-format-config";
import type { ExportFormat } from "@/components/meetings/downloads/types";
import { cn } from "@/lib/utils";

type ExportOptionProps = React.ComponentProps<"div"> & {
  format: ExportFormat;
  /** Overrides the format's default description. */
  description?: string;
};

/**
 * Icon, label, and description for a single export format. Reusable as a
 * compact format row on its own, or as the header chrome inside `ExportCard`.
 */
function ExportOption({
  className,
  format,
  description,
  ...props
}: ExportOptionProps) {
  const config = exportFormatConfig[format];
  const Icon = config.icon;

  return (
    <div
      data-slot="export-option"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      <div
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-sm font-medium text-foreground">
          {config.label}
        </h3>
        <p className="truncate text-xs text-muted-foreground">
          {description ?? config.description}
        </p>
      </div>
    </div>
  );
}

export { ExportOption };
export type { ExportOptionProps };
