import * as React from "react";
import { Download, Mic, MonitorPlay, Video, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/components/meetings/format";
import { cn } from "@/lib/utils";
import type {
  RecordingInfo,
  RecordingType,
} from "@/components/meetings/overview/types";

const recordingTypeConfig: Record<RecordingType, { label: string; icon: LucideIcon }> = {
  audio: { label: "Audio recording", icon: Mic },
  video: { label: "Video recording", icon: Video },
  "screen-recording": { label: "Screen recording", icon: MonitorPlay },
};

type RecordingCardProps = React.ComponentProps<"div"> & {
  recording?: RecordingInfo;
  loading?: boolean;
  /** Presentational only — the caller owns what downloading actually does. Omit to disable the button. */
  onDownload?: () => void;
};

/**
 * Summary of the source recording: type, duration, and audio quality, with a
 * download entry point. The download button is a placeholder — it only
 * calls back to the caller and never fetches or streams a file itself.
 */
function RecordingCard({
  className,
  recording,
  loading = false,
  onDownload,
  ...props
}: RecordingCardProps) {
  const config = recording ? recordingTypeConfig[recording.type] : undefined;
  const Icon = config?.icon ?? Mic;

  return (
    <Card data-slot="recording-card" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Recording</CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={!onDownload || loading || !recording}
          >
            <Download data-icon="inline-start" />
            Download
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          </div>
        ) : !recording ? (
          <EmptyState
            icon={<Mic />}
            title="No recording"
            description="The source recording will show up here once available."
          />
        ) : (
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            >
              <Icon className="size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <p className="font-medium text-foreground">{config?.label}</p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <span>{formatDuration(recording.durationSeconds)}</span>
                {recording.audioQuality && (
                  <>
                    <span aria-hidden="true">&middot;</span>
                    <span>{recording.audioQuality}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { RecordingCard };
export type { RecordingCardProps };
