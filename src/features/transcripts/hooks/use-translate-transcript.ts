"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { transcriptsApi } from "@/features/transcripts/api";
import type { TranslationLanguage } from "@/features/transcripts/types";

/** Generates the transcript translated into a target language and refreshes the cached transcript. */
export function useTranslateTranscript(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetLanguage: TranslationLanguage) =>
      transcriptsApi.translate(meetingId, targetLanguage),
    onSuccess: (response) => {
      queryClient.setQueryData(["transcripts", meetingId], response);
    },
  });
}
