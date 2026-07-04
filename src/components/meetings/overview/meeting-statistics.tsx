import * as React from "react";
import { Clock, FileText, HardDrive, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, type StatCardStatus } from "@/components/ui/stat-card";
import { formatBytes, formatDuration } from "@/components/meetings/format";
import { formatWordCount } from "@/components/meetings/overview/format";
import { cn } from "@/lib/utils";
import type {
  MeetingStatisticsData,
  SummaryStatus,
} from "@/components/meetings/overview/types";

const summaryStatusConfig: Record<
  SummaryStatus,
  { label: string; status: StatCardStatus }
> = {
  pending: { label: "Pending", status: "neutral" },
  generating: { label: "Generating", status: "info" },
  generated: { label: "Generated", status: "success" },
  failed: { label: "Failed", status: "error" },
};

type MeetingStatisticsProps = React.ComponentProps<"div"> & {
  data?: MeetingStatisticsData;
  loading?: boolean;
};

/**
 * At-a-glance processing metrics for the meeting: transcript length,
 * processing time, summary status, and recording size. Purely
 * presentational — missing fields render as a placeholder dash via StatCard.
 */
function MeetingStatistics({
  className,
  data,
  loading = false,
  ...props
}: MeetingStatisticsProps) {
  const summary = data?.summaryStatus
    ? summaryStatusConfig[data.summaryStatus]
    : undefined;

  return (
    <Card data-slot="meeting-statistics" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Statistics</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Transcript length"
          value={formatWordCount(data?.transcriptWordCount)}
          icon={FileText}
          loading={loading}
        />
        <StatCard
          title="Processing time"
          value={formatDuration(data?.processingTimeSeconds)}
          icon={Clock}
          loading={loading}
        />
        <StatCard
          title="Summary status"
          value={summary?.label}
          status={summary?.status}
          icon={Sparkles}
          loading={loading}
        />
        <StatCard
          title="Recording size"
          value={formatBytes(data?.recordingSizeBytes)}
          icon={HardDrive}
          loading={loading}
        />
      </CardContent>
    </Card>
  );
}

export { MeetingStatistics };
export type { MeetingStatisticsProps };
