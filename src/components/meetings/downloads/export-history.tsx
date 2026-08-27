import * as React from "react";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DownloadButton } from "@/components/meetings/downloads/download-button";
import { exportFormatConfig } from "@/components/meetings/downloads/export-format-config";
import type { ExportHistoryEntry } from "@/components/meetings/downloads/types";
import { formatDate } from "@/components/meetings/format";
import { cn } from "@/lib/utils";

type ExportHistoryProps = React.ComponentProps<"div"> & {
  entries?: ExportHistoryEntry[];
  loading?: boolean;
  /** IANA zone the "Available since" column renders in (e.g. the user's
   * timezone preference). Defaults to the browser's local zone. */
  timeZone?: string;
  /** Presentational only — the caller owns what downloading actually does. */
  onDownload?: (entry: ExportHistoryEntry) => void;
};

/**
 * Formats currently available to download: file name, format, the date the
 * underlying meeting was last updated, and a download action per row. Every
 * row is rendered fresh on download, not read from a stored export archive —
 * this is a list of what's downloadable now, not a log of past downloads.
 * Purely presentational — it never fetches a file itself, only renders
 * whatever `entries` is passed.
 */
function ExportHistory({
  className,
  entries,
  loading = false,
  timeZone,
  onDownload,
  ...props
}: ExportHistoryProps) {
  return (
    <Card data-slot="export-history" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h3">Available downloads</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-20 shrink-0" />
                <Skeleton className="size-7 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
        ) : !entries || entries.length === 0 ? (
          <EmptyState
            icon={<History />}
            title="No downloads yet"
            description="Formats you can export will show up here once a meeting finishes processing."
          />
        ) : (
          <Table aria-label="Available downloads">
            <TableHeader>
              <TableRow>
                <TableHead>File name</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Meeting updated</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="max-w-64 truncate font-medium text-foreground">
                    {entry.fileName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {exportFormatConfig[entry.format].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(entry.generatedAt, timeZone)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DownloadButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Download ${entry.fileName}`}
                      onClick={() => onDownload?.(entry)}
                      disabled={!onDownload}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export { ExportHistory };
export type { ExportHistoryProps };
