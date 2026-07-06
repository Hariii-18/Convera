"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { meetingsApi } from "@/features/meetings/api";

export function useDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => meetingsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}
