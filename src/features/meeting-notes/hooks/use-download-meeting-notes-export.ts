"use client";

import { useMutation } from "@tanstack/react-query";

import { meetingNotesApi } from "@/features/meeting-notes/api";
import type { MeetingNotesExportFormat } from "@/features/meeting-notes/types";

/** Triggers a browser save for a `Blob` without ever offering the file as a
 * clickable link. Mirrors `useExportMeetingNotes`'s helper of the same name.
 */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type DownloadMeetingNotesExportInput = {
  meetingId: string;
  format: MeetingNotesExportFormat;
};

/**
 * Same download as `useExportMeetingNotes`, but not bound to one meeting at
 * hook-creation time — `meetingId` is supplied per call instead, for a
 * caller (like the Downloads list) that downloads across many meetings from
 * one place. Mirrors `useDownloadTranscript`'s shape for the same reason.
 */
export function useDownloadMeetingNotesExport() {
  return useMutation({
    mutationFn: async ({ meetingId, format }: DownloadMeetingNotesExportInput) => {
      const { blob, filename } = await meetingNotesApi.downloadExport(meetingId, format);
      saveBlob(blob, filename);
      return format;
    },
  });
}
