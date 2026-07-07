"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { processingApi } from "@/features/processing/api";
import { toProcessingJob } from "@/features/processing/mappers";

export function useRetryProcessing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      toProcessingJob(await processingApi.retry(id)),
    onSuccess: () => {
      toast("Retrying processing job");
      queryClient.invalidateQueries({ queryKey: ["processing"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}
