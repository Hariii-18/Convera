"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { summariesApi } from "@/features/summaries/api";

/** Runs the Local Summary Engine for a meeting and refreshes the cached summary. */
export function useRegenerateSummary(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => summariesApi.generate(meetingId),
    onSuccess: (response) => {
      queryClient.setQueryData(["summaries", meetingId], response);
    },
  });
}
