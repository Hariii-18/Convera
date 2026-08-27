"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { meetingNotesApi } from "@/features/meeting-notes/api";
import { toMeetingNotes } from "@/features/meeting-notes/mappers";
import { isTerminalStatus } from "@/features/processing/mappers";
import type { ProcessingJobStatus } from "@/features/processing/types";

const POLL_INTERVAL_MS = 3000;

/**
 * Fetches Meeting Notes — the derived transcript+summary composite — for a
 * meeting, if ready yet. `null` (no error) means the meeting doesn't have a
 * transcript and/or summary yet; the backend maps that 404 case, not a
 * failure, so it's surfaced the same way `useSummary`/`useTranscript` do.
 *
 * Polls while the meeting's processing job is still in flight so the notes
 * tab picks up the transcript+summary right after the job completes,
 * mirroring `useSummary`'s polling/invalidation pattern.
 */
export function useMeetingNotes(
  meetingId: string,
  options?: { enabled?: boolean; jobStatus?: ProcessingJobStatus | null },
) {
  const jobStatus = options?.jobStatus;
  const queryClient = useQueryClient();
  const lastJobStatusRef = useRef<ProcessingJobStatus | null | undefined>(undefined);

  const query = useQuery({
    queryKey: ["meeting-notes", meetingId],
    queryFn: () => meetingNotesApi.getByMeeting(meetingId),
    select: (data) => (data ? toMeetingNotes(data) : null),
    enabled: Boolean(meetingId) && (options?.enabled ?? true),
    refetchInterval: () => {
      if (!jobStatus || isTerminalStatus(jobStatus)) return false;
      return POLL_INTERVAL_MS;
    },
  });

  // Force one refetch whenever the job settles into a terminal state — see
  // `useTranscript` for why this is needed despite `refetchOnWindowFocus`
  // being disabled app-wide.
  useEffect(() => {
    const previousJobStatus = lastJobStatusRef.current;
    lastJobStatusRef.current = jobStatus;
    if (jobStatus && isTerminalStatus(jobStatus) && previousJobStatus !== jobStatus) {
      queryClient.invalidateQueries({ queryKey: ["meeting-notes", meetingId] });
    }
  }, [jobStatus, meetingId, queryClient]);

  return query;
}
