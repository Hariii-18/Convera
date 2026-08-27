"use client";

import { useMutation } from "@tanstack/react-query";

import { transcriptsApi } from "@/features/transcripts/api";
import type { ConversationExportFormat } from "@/features/transcripts/types";

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

/** Downloads the meeting's transcript rendered as speaker dialogue in
 * `format` and saves it to disk. Renders server-side from the same
 * speaker-resolved segments the Conversation tab reads, so a download
 * always matches what's on screen.
 */
export function useExportConversation(meetingId: string) {
  return useMutation({
    mutationFn: async (format: ConversationExportFormat) => {
      const { blob, filename } = await transcriptsApi.downloadConversationExport(
        meetingId,
        format,
      );
      saveBlob(blob, filename);
      return format;
    },
  });
}
