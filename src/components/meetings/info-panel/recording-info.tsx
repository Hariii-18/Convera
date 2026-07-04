import * as React from "react";
import { Mic, MonitorPlay, Video, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatDuration } from "@/components/meetings/format";
import { MetaRow } from "@/components/meetings/meta-row";
import type {
  RecordingInfoData,
  RecordingType,
} from "@/components/meetings/info-panel/types";
import { cn } from "@/lib/utils";

const recordingTypeConfig: Record<RecordingType, { label: string; icon: LucideIcon }> = {
  audio: { label: "Audio", icon: Mic },
  video: { label: "Video", icon: Video },
  "screen-recording": { label: "Screen recording", icon: MonitorPlay },
};

type RecordingInfoProps = React.ComponentProps<"div"> & {
  recording?: RecordingInfoData;
  loading?: boolean;
};

/**
 * Compact facts about the source recording for the workspace info rail:
 * type, duration, size, and quality. Purely presentational.
 */
function RecordingInfo({
  className,
  recording,
  loading = false,
  ...props
}: RecordingInfoProps) {
  return (
    <Card data-slot="recording-info" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Recording</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : !recording ? (
          <EmptyState
            icon={<Mic />}
            title="No recording"
            description="Recording details will show up here once available."
          />
        ) : (
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
            <MetaRow label="Type">
              {recordingTypeConfig[recording.type].label}
            </MetaRow>
            <MetaRow label="Duration">
              {formatDuration(recording.durationSeconds)}
            </MetaRow>
            {recording.sizeBytes !== undefined && (
              <MetaRow label="Size">{formatBytes(recording.sizeBytes)}</MetaRow>
            )}
            {recording.quality && (
              <MetaRow label="Quality">{recording.quality}</MetaRow>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export { RecordingInfo };
export type { RecordingInfoProps };
