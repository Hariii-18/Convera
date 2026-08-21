"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { transcriptsApi } from "@/features/transcripts/api";
import { toTranscript } from "@/features/transcripts/mappers";
import { isTerminalStatus } from "@/features/processing/mappers";
import type { ProcessingJobStatus } from "@/features/processing/types";

const POLL_INTERVAL_MS = 3000;

/**
 * Fetches the transcript for a meeting, if one exists yet. `null` (no error)
 * means the meeting hasn't been transcribed yet — that's an expected state,
 * not a failure, so 404s are mapped to `null` by `transcriptsApi.getByMeeting`
 * instead of rejecting.
 *
 * Polls while the meeting's processing job is still in flight so the
 * transcript tab picks up the result right after the job completes, without
 * the caller having to wire up its own refetch.
 */
export function useTranscript(
  meetingId: string,
  options?: { enabled?: boolean; jobStatus?: ProcessingJobStatus | null },
) {
  const jobStatus = options?.jobStatus;
  const queryClient = useQueryClient();
  const lastJobStatusRef = useRef<ProcessingJobStatus | null | undefined>(undefined);

  const query = useQuery({
    queryKey: ["transcripts", meetingId],
    queryFn: () => transcriptsApi.getByMeeting(meetingId),
    select: (data) => (data ? toTranscript(data) : null),
    enabled: Boolean(meetingId) && (options?.enabled ?? true),
    refetchInterval: () => {
      if (!jobStatus || isTerminalStatus(jobStatus)) return false;
      return POLL_INTERVAL_MS;
    },
  });

  // The job can flip to terminal (and the transcript row get written)
  // between two polls, or the meeting can already be "completed" on first
  // load. Either way, `refetchInterval` above stops polling right as/after
  // that happens, and with `refetchOnWindowFocus` disabled and a 60s
  // `staleTime` app-wide, nothing else would ever refetch this query — so
  // the last cached result (often still `null` from mid-processing) would
  // stick around forever. Force one refetch whenever we observe the job
  // settle into a terminal state to close that gap.
  useEffect(() => {
    const previousJobStatus = lastJobStatusRef.current;
    lastJobStatusRef.current = jobStatus;
    if (jobStatus && isTerminalStatus(jobStatus) && previousJobStatus !== jobStatus) {
      queryClient.invalidateQueries({ queryKey: ["transcripts", meetingId] });
    }
  }, [jobStatus, meetingId, queryClient]);

  return query;
}
