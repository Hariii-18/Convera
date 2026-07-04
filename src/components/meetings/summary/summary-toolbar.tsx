import * as React from "react";
import { Clock, Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Separator } from "@/components/ui/separator";
import { formatReadingTime } from "@/components/meetings/summary/format";
import { cn } from "@/lib/utils";

type SummaryToolbarProps = React.ComponentProps<"div"> & {
  /** Full summary text, used by the copy button. */
  summaryText?: string;
  /** Pre-counted word total across every section, used to derive reading time. */
  wordCount?: number;
  onCopy?: () => void;
  /** Presentational placeholder — the caller owns what exporting actually does. */
  onExport?: () => void;
  /** Presentational placeholder — the caller owns what regenerating actually does. */
  onRegenerate?: () => void;
};

/**
 * Action bar for the meeting summary: copy, export, regenerate, and an
 * estimated reading time. Every action is a callback into the caller — this
 * component holds no summary state of its own.
 */
function SummaryToolbar({
  className,
  summaryText = "",
  wordCount,
  onCopy,
  onExport,
  onRegenerate,
  ...props
}: SummaryToolbarProps) {
  return (
    <div
      data-slot="summary-toolbar"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      {wordCount !== undefined && (
        <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
          <Clock aria-hidden="true" className="size-3.5" />
          {formatReadingTime(wordCount)}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <CopyButton text={summaryText} label="Copy Summary" onCopy={onCopy} />

        <Separator orientation="vertical" className="h-5" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={!onExport}
        >
          <Download data-icon="inline-start" />
          Export
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={!onRegenerate}
        >
          <RefreshCw data-icon="inline-start" />
          Regenerate
        </Button>
      </div>
    </div>
  );
}

export { SummaryToolbar };
export type { SummaryToolbarProps };
