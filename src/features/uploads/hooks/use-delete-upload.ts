"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadsApi } from "@/features/uploads/api";

export function useDeleteUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => uploadsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}
