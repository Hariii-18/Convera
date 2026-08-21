"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { summariesApi } from "@/features/summaries/api";
import { toSummary } from "@/features/summaries/mappers";
import { isTerminalStatus } from "@/features/processing/mappers";
import type { ProcessingJobStatus } from "@/features/processing/types";

const POLL_INTERVAL_MS = 3000;

/**
 * Fetches the summary for a meeting, if one has been generated yet. `null`
 * (no error) means the meeting hasn't been summarized yet — that's an
 * expected state, not a failure, so 404s are mapped to `null` by
 * `summariesApi.getByMeeting` instead of rejecting.
 *
 * Polls while the meeting's processing job is still in flight so the
 * summary tab picks up the auto-generated result right after the job
 * completes, without the caller having to wire up its own refetch. Mirrors
 * `useTranscript`'s polling/invalidation pattern.
 */
export function useSummary(
  meetingId: string,
  options?: { enabled?: boolean; jobStatus?: ProcessingJobStatus | null },
) {
  const jobStatus = options?.jobStatus;
  const queryClient = useQueryClient();
  const lastJobStatusRef = useRef<ProcessingJobStatus | null | undefined>(undefined);

  const query = useQuery({
    queryKey: ["summaries", meetingId],
    queryFn: () => summariesApi.getByMeeting(meetingId),
    select: (data) => (data ? toSummary(data) : null),
    enabled: Boolean(meetingId) && (options?.enabled ?? true),
    refetchInterval: () => {
      if (!jobStatus || isTerminalStatus(jobStatus)) return false;
      return POLL_INTERVAL_MS;
    },
  });

  // Force one refetch whenever the job settles into a terminal state, so
  // the auto-generated summary (or a cleared/failed state) shows up even
  // though `refetchOnWindowFocus` is disabled and nothing else would
  // otherwise invalidate this query. See `useTranscript` for the same gap.
  useEffect(() => {
    const previousJobStatus = lastJobStatusRef.current;
    lastJobStatusRef.current = jobStatus;
    if (jobStatus && isTerminalStatus(jobStatus) && previousJobStatus !== jobStatus) {
      queryClient.invalidateQueries({ queryKey: ["summaries", meetingId] });
    }
  }, [jobStatus, meetingId, queryClient]);

  return query;
}
