"use client";

import { useQuery } from "@tanstack/react-query";

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
 * Summary tab picks up the auto-generated summary right after the job
 * completes, without the caller having to wire up its own refetch (mirrors
 * `useTranscript`).
 */
export function useSummary(
  meetingId: string,
  options?: { enabled?: boolean; jobStatus?: ProcessingJobStatus | null },
) {
  return useQuery({
    queryKey: ["summaries", meetingId],
    queryFn: () => summariesApi.getByMeeting(meetingId),
    select: (data) => (data ? toSummary(data) : null),
    enabled: Boolean(meetingId) && (options?.enabled ?? true),
    refetchInterval: () => {
      const jobStatus = options?.jobStatus;
      if (!jobStatus || isTerminalStatus(jobStatus)) return false;
      return POLL_INTERVAL_MS;
    },
  });
}
