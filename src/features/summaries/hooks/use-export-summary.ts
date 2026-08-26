"use client";

import { useMutation } from "@tanstack/react-query";

import { summariesApi } from "@/features/summaries/api";
import type { SummaryExportFormat } from "@/features/summaries/types";

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

/** Downloads the current saved Summary tab content as `format` and saves it
 * to disk. Always reflects whatever is currently saved — the backend renders
 * from the same persisted `Summary` row `useSummary` reads.
 */
export function useExportSummary(meetingId: string) {
  return useMutation({
    mutationFn: async (format: SummaryExportFormat) => {
      const { blob, filename } = await summariesApi.downloadExport(meetingId, format);
      saveBlob(blob, filename);
      return format;
    },
  });
}
