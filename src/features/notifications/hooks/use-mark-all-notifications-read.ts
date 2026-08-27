"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { notificationsApi } from "@/features/notifications/api";

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
