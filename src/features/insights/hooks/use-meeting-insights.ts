"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { insightsApi } from "@/features/insights/api";
import { toMeetingInsights } from "@/features/insights/mappers";
import { isTerminalStatus } from "@/features/processing/mappers";
import type { ProcessingJobStatus } from "@/features/processing/types";

const POLL_INTERVAL_MS = 3000;

/**
 * Fetches AI Insights for a meeting, derived from its Summary. `hasSummary:
 * false` (no error) means the meeting hasn't been summarized yet — an
 * expected state, not a failure.
 *
 * Polls while the meeting's processing job is still in flight so insights
 * pick up the auto-generated Summary right after the job completes, without
 * the caller wiring up its own refetch. Mirrors `useSummary`/`useTimeline`'s
 * polling/invalidation pattern.
 */
export function useMeetingInsights(
  meetingId: string,
  options?: { enabled?: boolean; jobStatus?: ProcessingJobStatus | null },
) {
  const jobStatus = options?.jobStatus;
  const queryClient = useQueryClient();
  const lastJobStatusRef = useRef<ProcessingJobStatus | null | undefined>(undefined);

  const query = useQuery({
    queryKey: ["insights", meetingId],
    queryFn: () => insightsApi.getByMeeting(meetingId),
    select: toMeetingInsights,
    enabled: Boolean(meetingId) && (options?.enabled ?? true),
    refetchInterval: () => {
      if (!jobStatus || isTerminalStatus(jobStatus)) return false;
      return POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    const previousJobStatus = lastJobStatusRef.current;
    lastJobStatusRef.current = jobStatus;
    if (jobStatus && isTerminalStatus(jobStatus) && previousJobStatus !== jobStatus) {
      queryClient.invalidateQueries({ queryKey: ["insights", meetingId] });
    }
  }, [jobStatus, meetingId, queryClient]);

  return query;
}
