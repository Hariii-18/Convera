"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { processingApi } from "@/features/processing/api";

export function useCancelProcessing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => processingApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processing"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}
