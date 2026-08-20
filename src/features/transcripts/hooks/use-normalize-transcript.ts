"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { transcriptsApi } from "@/features/transcripts/api";

/** Generates the readability-normalized transcript and refreshes the cached transcript. */
export function useNormalizeTranscript(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => transcriptsApi.normalize(meetingId),
    onSuccess: (response) => {
      queryClient.setQueryData(["transcripts", meetingId], response);
    },
  });
}
