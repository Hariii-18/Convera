"use client";

import { useQuery } from "@tanstack/react-query";

import { meetingSpeakersApi } from "@/features/meeting-speakers/api";

export function meetingSpeakersQueryKey(meetingId: string) {
  return ["meeting-speakers", meetingId] as const;
}

/** Fetches the manually-managed speaker list for a meeting. Empty until a
 * user adds speakers by hand — see `useCreateMeetingSpeaker`. */
export function useMeetingSpeakers(
  meetingId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: meetingSpeakersQueryKey(meetingId),
    queryFn: () => meetingSpeakersApi.listByMeeting(meetingId),
    enabled: Boolean(meetingId) && (options?.enabled ?? true),
  });
}
