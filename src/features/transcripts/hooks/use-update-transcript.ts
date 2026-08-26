"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { transcriptsApi } from "@/features/transcripts/api";
import type { TranscriptUpdateRequest } from "@/features/transcripts/types";

/** Saves raw transcript segment-text edits and updates the cached copy so a
 * reload isn't needed to see them reflected. `useTranscript` maps this raw
 * response via its `select`, so the cache is seeded with the same
 * (pre-`select`) shape its `queryFn` returns. Never touches the normalized
 * or translated transcript — the backend endpoint this calls can't reach
 * either.
 */
export function useUpdateTranscript(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TranscriptUpdateRequest) =>
      transcriptsApi.update(meetingId, payload),
    onSuccess: (response) => {
      queryClient.setQueryData(["transcripts", meetingId], response);
    },
  });
}
