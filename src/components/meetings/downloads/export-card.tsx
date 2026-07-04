import * as React from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DownloadButton } from "@/components/meetings/downloads/download-button";
import { ExportOption } from "@/components/meetings/downloads/export-option";
import { formatBytes, formatRelativeTime } from "@/components/meetings/format";
import type { ExportCardData } from "@/components/meetings/downloads/types";
import { cn } from "@/lib/utils";

type ExportCardProps = React.ComponentProps<"div"> & {
  data: ExportCardData;
  loading?: boolean;
  /** Presentational only — the caller owns what downloading actually does. Omit to disable the button. */
  onDownload?: () => void;
  /** Presentational only — the caller owns what regenerating actually does. Omit to disable the button. */
  onRegenerate?: () => void;
  downloading?: boolean;
  regenerating?: boolean;
};

/**
 * A single export format's card: format, description, optional file size and
 * last-generated timestamp, and download/regenerate actions. Neither action
 * does anything on its own — both are placeholders that call back to the
 * caller.
 */
function ExportCard({
  className,
  data,
  loading = false,
  onDownload,
  onRegenerate,
  downloading = false,
  regenerating = false,
  ...props
}: ExportCardProps) {
  const hasGenerated = data.fileSizeBytes !== undefined || Boolean(data.lastGeneratedAt);

  return (
    <Card data-slot="export-card" className={cn(className)} {...props}>
      <CardHeader>
        <ExportOption format={data.format} description={data.description} />
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Regenerate ${data.format.toUpperCase()} export`}
            onClick={onRegenerate}
            disabled={!onRegenerate || loading || regenerating}
          >
            <RefreshCw className={cn(regenerating && "animate-spin")} />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
          </div>
        ) : hasGenerated ? (
          <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {data.fileSizeBytes !== undefined && (
              <div className="flex items-center gap-1">
                <dt className="sr-only">File size</dt>
                <dd>{formatBytes(data.fileSizeBytes)}</dd>
              </div>
            )}
            {data.lastGeneratedAt && (
              <div className="flex items-center gap-1">
                <dt className="sr-only">Last generated</dt>
                <dd>Generated {formatRelativeTime(data.lastGeneratedAt)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">Not generated yet.</p>
        )}
      </CardContent>

      <CardFooter>
        <DownloadButton
          className="w-full"
          onClick={onDownload}
          loading={downloading}
          disabled={!onDownload || loading || !hasGenerated}
        />
      </CardFooter>
    </Card>
  );
}

export { ExportCard };
export type { ExportCardProps };
