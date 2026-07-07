import * as React from "react";

import { cn } from "@/lib/utils";
import { MeetingMetadata } from "@/components/meetings/overview/meeting-metadata";
import { MeetingStatistics } from "@/components/meetings/overview/meeting-statistics";
import { ProcessingStatusCard } from "@/components/meetings/overview/processing-status-card";
import { RecordingCard } from "@/components/meetings/overview/recording-card";
import { SummaryPreview } from "@/components/meetings/overview/summary-preview";
import { TimelinePreview } from "@/components/meetings/overview/timeline-preview";
import { RecentActivity } from "@/components/meetings/overview/recent-activity";
import type {
  ActivityItem,
  MeetingMetadataData,
  MeetingStatisticsData,
  RecordingInfo,
  TimelineEventPreview,
} from "@/components/meetings/overview/types";
import type { ProcessingJob } from "@/features/processing/mappers";

type MeetingOverviewProps = React.ComponentProps<"div"> & {
  metadata?: MeetingMetadataData;
  statistics?: MeetingStatisticsData;
  recording?: RecordingInfo;
  /** Full summary text — only the first few lines are shown here. */
  summary?: string;
  timelineEvents?: TimelineEventPreview[];
  activity?: ActivityItem[];
  /** This meeting's live processing job, if any. `undefined` while loading, `null` once loaded with none. */
  processingJob?: ProcessingJob | null;
  processingJobLoading?: boolean;
  /** Renders every section's skeleton state. */
  loading?: boolean;
  onViewFullSummary?: () => void;
  onViewTimeline?: () => void;
  /** Presentational only — the caller owns what downloading actually does. */
  onDownloadRecording?: () => void;
};

/**
 * Overview tab of the meeting workspace: metadata, key stats, the source
 * recording, and previews of the summary, timeline, and recent activity.
 * Purely presentational — everything renders from props, and every section
 * supports its own empty/loading state independently.
 */
function MeetingOverview({
  className,
  metadata,
  statistics,
  recording,
  summary,
  timelineEvents,
  activity,
  processingJob,
  processingJobLoading = false,
  loading = false,
  onViewFullSummary,
  onViewTimeline,
  onDownloadRecording,
  ...props
}: MeetingOverviewProps) {
  return (
    <div
      data-slot="meeting-overview"
      className={cn("grid grid-cols-1 gap-6 lg:grid-cols-3", className)}
      {...props}
    >
      <div className="flex flex-col gap-6 lg:col-span-2">
        <MeetingStatistics data={statistics} loading={loading} />
        <SummaryPreview
          summary={summary}
          loading={loading}
          onViewFullSummary={onViewFullSummary}
        />
        <TimelinePreview
          events={timelineEvents}
          loading={loading}
          onViewTimeline={onViewTimeline}
        />
      </div>

      <div className="flex flex-col gap-6">
        <MeetingMetadata data={metadata} loading={loading} />
        <ProcessingStatusCard
          job={processingJob}
          loading={loading || processingJobLoading}
        />
        <RecordingCard
          recording={recording}
          loading={loading}
          onDownload={onDownloadRecording}
        />
        <RecentActivity items={activity} loading={loading} />
      </div>
    </div>
  );
}

export { MeetingOverview };
export type { MeetingOverviewProps };
