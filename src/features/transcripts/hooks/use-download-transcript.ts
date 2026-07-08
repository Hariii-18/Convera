"use client";

import { useMutation } from "@tanstack/react-query";

import { transcriptsApi } from "@/features/transcripts/api";
import { toTranscript } from "@/features/transcripts/mappers";
import {
  downloadTranscriptFile,
  type TranscriptDownloadFormat,
} from "@/features/transcripts/download";

export type DownloadTranscriptInput = {
  meetingId: string;
  format: TranscriptDownloadFormat;
  fileName: string;
};

/** Fetches a meeting's transcript on demand and saves it as a local file. */
export function useDownloadTranscript() {
  return useMutation({
    mutationFn: async ({ meetingId, format, fileName }: DownloadTranscriptInput) => {
      const response = await transcriptsApi.getByMeeting(meetingId);
      if (!response) throw new Error("Transcript isn't ready yet");
      downloadTranscriptFile(toTranscript(response), format, fileName);
    },
  });
}
