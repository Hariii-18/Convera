import * as React from "react";
import { Download } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { DownloadsPanelSkeleton } from "@/components/meetings/downloads/downloads-panel-skeleton";
import { ExportCard } from "@/components/meetings/downloads/export-card";
import { ExportHistory } from "@/components/meetings/downloads/export-history";
import type {
  ExportCardData,
  ExportFormat,
  ExportHistoryEntry,
} from "@/components/meetings/downloads/types";
import { cn } from "@/lib/utils";

type DownloadsPanelProps = React.ComponentProps<"div"> & {
  exports?: ExportCardData[];
  history?: ExportHistoryEntry[];
  /** Renders every section's skeleton state. */
  loading?: boolean;
  /** Presentational only — the caller owns what downloading actually does. */
  onDownload?: (format: ExportFormat) => void;
  /** Presentational only — the caller owns what regenerating actually does. */
  onRegenerate?: (format: ExportFormat) => void;
  onDownloadHistoryEntry?: (entry: ExportHistoryEntry) => void;
  /** Formats currently mid-download, e.g. from an in-flight request. */
  downloadingFormats?: ExportFormat[];
  /** Formats currently mid-regeneration, e.g. from an in-flight request. */
  regeneratingFormats?: ExportFormat[];
};

/**
 * Downloads & Export Center for a meeting: one card per export format plus a
 * history of previously generated files. Purely presentational — it never
 * generates, fetches, or downloads a file itself, only calls back to
 * whatever the caller wires up.
 */
function DownloadsPanel({
  className,
  exports,
  history,
  loading = false,
  onDownload,
  onRegenerate,
  onDownloadHistoryEntry,
  downloadingFormats = [],
  regeneratingFormats = [],
  ...props
}: DownloadsPanelProps) {
  const hasExports = Boolean(exports && exports.length > 0);

  return (
    <div
      data-slot="downloads-panel"
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-medium text-foreground">
          Downloads &amp; export
        </h2>
        <p className="text-sm text-muted-foreground">
          Generate and download this meeting in multiple formats.
        </p>
      </div>

      {loading ? (
        <>
          <span role="status" className="sr-only">
            Loading export formats&hellip;
          </span>
          <DownloadsPanelSkeleton />
        </>
      ) : !hasExports ? (
        <EmptyState
          icon={<Download />}
          title="No export formats available"
          description="Export formats will appear here once this meeting is ready."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {exports!.map((data) => (
            <ExportCard
              key={data.format}
              data={data}
              onDownload={
                onDownload ? () => onDownload(data.format) : undefined
              }
              onRegenerate={
                onRegenerate ? () => onRegenerate(data.format) : undefined
              }
              downloading={downloadingFormats.includes(data.format)}
              regenerating={regeneratingFormats.includes(data.format)}
            />
          ))}
        </div>
      )}

      <ExportHistory
        entries={history}
        loading={loading}
        onDownload={onDownloadHistoryEntry}
      />
    </div>
  );
}

export { DownloadsPanel };
export type { DownloadsPanelProps };
