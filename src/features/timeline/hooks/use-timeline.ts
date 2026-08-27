"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { timelineApi } from "@/features/timeline/api";
import { toTimelineEvents } from "@/features/timeline/mappers";
import { isTerminalStatus } from "@/features/processing/mappers";
import type { ProcessingJobStatus } from "@/features/processing/types";

const POLL_INTERVAL_MS = 3000;

/**
 * Fetches timeline events for a meeting. An empty array (no error) means no
 * events have been generated yet — that's an expected state, not a failure.
 *
 * Polls while the meeting's processing job is still in flight so the
 * timeline picks up the auto-generated result right after the job
 * completes. Mirrors `useSummary`'s polling/invalidation pattern.
 */
export function useTimeline(
  meetingId: string,
  options?: { enabled?: boolean; jobStatus?: ProcessingJobStatus | null },
) {
  const jobStatus = options?.jobStatus;
  const queryClient = useQueryClient();
  const lastJobStatusRef = useRef<ProcessingJobStatus | null | undefined>(undefined);

  const query = useQuery({
    queryKey: ["timeline", meetingId],
    queryFn: () => timelineApi.getByMeeting(meetingId),
    select: toTimelineEvents,
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
      queryClient.invalidateQueries({ queryKey: ["timeline", meetingId] });
    }
  }, [jobStatus, meetingId, queryClient]);

  return query;
}
