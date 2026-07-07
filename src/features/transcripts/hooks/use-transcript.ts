"use client";

import { useQuery } from "@tanstack/react-query";

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
  return useQuery({
    queryKey: ["transcripts", meetingId],
    queryFn: () => transcriptsApi.getByMeeting(meetingId),
    select: (data) => (data ? toTranscript(data) : null),
    enabled: Boolean(meetingId) && (options?.enabled ?? true),
    refetchInterval: () => {
      const jobStatus = options?.jobStatus;
      if (!jobStatus || isTerminalStatus(jobStatus)) return false;
      return POLL_INTERVAL_MS;
    },
  });
}
