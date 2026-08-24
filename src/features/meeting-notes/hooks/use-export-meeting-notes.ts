"use client";

import { useMutation } from "@tanstack/react-query";

import { meetingNotesApi } from "@/features/meeting-notes/api";
import type { MeetingNotesExportFormat } from "@/features/meeting-notes/types";

/** Triggers a browser save for a `Blob` without ever offering the file as a
 * clickable link (the artifact viewer's sandbox — and some embedded
 * webviews — block those; a synthetic click on a transient object URL still
 * works everywhere).
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

/** Downloads the current saved Meeting Notes as `format` and saves it to
 * disk. Always reflects whatever is currently saved (edits included) — the
 * backend renders from the same persisted record `useMeetingNotes` reads.
 */
export function useExportMeetingNotes(meetingId: string) {
  return useMutation({
    mutationFn: async (format: MeetingNotesExportFormat) => {
      const { blob, filename } = await meetingNotesApi.downloadExport(meetingId, format);
      saveBlob(blob, filename);
      return format;
    },
  });
}
