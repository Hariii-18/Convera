"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { summariesApi } from "@/features/summaries/api";
import type { SummaryActionItemUpdateRequest } from "@/features/summaries/types";

/**
 * Persists a status/owner/due_date/text edit to one Summary action item and
 * reseeds the cached summary with the server's response, so the change
 * survives a reload without a refetch. Mirrors `useUpdateMeetingNotes` /
 * `useRegenerateSummary`'s cache-seeding pattern.
 */
export function useUpdateActionItem(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      index,
      payload,
    }: {
      index: number;
      payload: SummaryActionItemUpdateRequest;
    }) => summariesApi.updateActionItem(meetingId, index, payload),
    onSuccess: (response) => {
      queryClient.setQueryData(["summaries", meetingId], response);
    },
  });
}
