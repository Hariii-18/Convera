"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { liveMeetingsApi } from "@/features/live-meetings/api";
import { toLiveMeetingSession } from "@/features/live-meetings/mappers";

/** Transitions the session `live -> stopping`. Does not finalize it. */
export function useStopLiveMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) => {
      const response = await liveMeetingsApi.stop(meetingId);
      return toLiveMeetingSession(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}
