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
  /** Presentational only — the caller owns what downloading actually does. */
  onDownload?: (entry: ExportHistoryEntry) => void;
};

/**
 * Log of previously generated exports: file name, format, generated date,
 * and a download action per row. Purely presentational — it never fetches or
 * regenerates a file, only renders whatever `entries` is passed.
 */
function ExportHistory({
  className,
  entries,
  loading = false,
  onDownload,
  ...props
}: ExportHistoryProps) {
  return (
    <Card data-slot="export-history" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h3">Export history</CardTitle>
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
            title="No exports yet"
            description="Files you generate will show up here with their format and generation date."
          />
        ) : (
          <Table aria-label="Export history">
            <TableHeader>
              <TableRow>
                <TableHead>File name</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Generated</TableHead>
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
                    {formatDate(entry.generatedAt)}
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
