"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { meetingNotesApi } from "@/features/meeting-notes/api";
import type { MeetingNotesUpdateRequest } from "@/features/meeting-notes/types";

/** Saves Meeting Notes edits and updates the cached copy so a reload isn't
 * needed to see them reflected. `useMeetingNotes` maps this raw response via
 * its `select`, so the cache is seeded with the same (pre-`select`) shape
 * its `queryFn` returns. Never touches transcript/summary caches — the
 * backend endpoint this calls can't reach either.
 */
export function useUpdateMeetingNotes(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MeetingNotesUpdateRequest) =>
      meetingNotesApi.update(meetingId, payload),
    onSuccess: (response) => {
      queryClient.setQueryData(["meeting-notes", meetingId], response);
    },
  });
}
