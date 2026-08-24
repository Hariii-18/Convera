"use client";

import { useMutation } from "@tanstack/react-query";

import { meetingNotesApi } from "@/features/meeting-notes/api";
import type { MeetingNotesExportFormat } from "@/features/meeting-notes/types";

/** Emails the current saved Meeting Notes as `format` to the authenticated
 * user's own address. `useMutation`'s `isPending` doubles as the duplicate-
 * click guard — the caller disables the button while a send is in flight.
 */
export function useSendMeetingNotesEmail(meetingId: string) {
  return useMutation({
    mutationFn: async (format: MeetingNotesExportFormat) => {
      const result = await meetingNotesApi.sendEmail(meetingId, format);
      return { ...result, format };
    },
  });
}
