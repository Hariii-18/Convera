import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AIInsightsPlaceholder } from "@/components/meetings/info-panel/ai-insights-placeholder";
import { MeetingInfoPanelSkeleton } from "@/components/meetings/info-panel/meeting-info-panel-skeleton";
import { MeetingTags } from "@/components/meetings/info-panel/meeting-tags";
import { ParticipantsCard } from "@/components/meetings/info-panel/participants-card";
import { ProcessingInfo } from "@/components/meetings/info-panel/processing-info";
import { RecordingInfo } from "@/components/meetings/info-panel/recording-info";
import type {
  MeetingTag,
  Participant,
  ProcessingInfoData,
  RecordingInfoData,
} from "@/components/meetings/info-panel/types";
import { cn } from "@/lib/utils";

type MeetingInfoPanelProps = React.ComponentProps<"div"> & {
  participants?: Participant[];
  tags?: MeetingTag[];
  recording?: RecordingInfoData;
  processing?: ProcessingInfoData;
  /** Renders the whole panel's skeleton state in place of every section. */
  loading?: boolean;
};

/**
 * Right-side info rail for the meeting workspace: participants, tags,
 * recording details, processing status, and a placeholder for AI insights.
 * Purely presentational — every section renders from props and reuses
 * existing card/badge/avatar primitives.
 */
function MeetingInfoPanel({
  className,
  participants,
  tags,
  recording,
  processing,
  loading = false,
  ...props
}: MeetingInfoPanelProps) {
  return (
    <div
      data-slot="meeting-info-panel"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      {loading ? (
        <>
          <span role="status" className="sr-only">
            Loading meeting details&hellip;
          </span>
          <MeetingInfoPanelSkeleton />
        </>
      ) : (
        <>
          <ParticipantsCard participants={participants} />

          <Card data-slot="meeting-tags-card">
            <CardHeader>
              <CardTitle as="h2">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingTags tags={tags} />
            </CardContent>
          </Card>

          <RecordingInfo recording={recording} />
          <ProcessingInfo data={processing} />
          <AIInsightsPlaceholder />
        </>
      )}
    </div>
  );
}

export { MeetingInfoPanel };
export type { MeetingInfoPanelProps };
