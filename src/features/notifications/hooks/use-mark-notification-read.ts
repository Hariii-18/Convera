"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { notificationsApi } from "@/features/notifications/api";

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
