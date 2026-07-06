"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { meetingsApi } from "@/features/meetings/api";
import type { MeetingUpdatePayload } from "@/features/meetings/types";

export function useUpdateMeeting(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MeetingUpdatePayload) =>
      meetingsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["meetings", id] });
    },
  });
}
