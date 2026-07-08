"use client";

import { useQuery } from "@tanstack/react-query";

import { summariesApi } from "@/features/summaries/api";
import { toSummary } from "@/features/summaries/mappers";

/**
 * Fetches the summary for a meeting, if one has been generated yet. `null`
 * (no error) means the meeting hasn't been summarized yet — that's an
 * expected state, not a failure, so 404s are mapped to `null` by
 * `summariesApi.getByMeeting` instead of rejecting.
 */
export function useSummary(meetingId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["summaries", meetingId],
    queryFn: () => summariesApi.getByMeeting(meetingId),
    select: (data) => (data ? toSummary(data) : null),
    enabled: Boolean(meetingId) && (options?.enabled ?? true),
  });
}
