"use client";

import { useMutation } from "@tanstack/react-query";

import { meetingNotesApi } from "@/features/meeting-notes/api";
import type { MeetingNotesExportFormat } from "@/features/meeting-notes/types";

export type SendMeetingNotesEmailInput = {
  format: MeetingNotesExportFormat;
  sendToMe: boolean;
  recipients: string[];
};

/** Emails the current saved Meeting Notes as `format` to every resolved
 * recipient (the authenticated user's own address when `sendToMe`, plus
 * `recipients`). `useMutation`'s `isPending` doubles as the duplicate-click
 * guard — the caller disables the Send button while a send is in flight.
 */
export function useSendMeetingNotesEmail(meetingId: string) {
  return useMutation({
    mutationFn: async (input: SendMeetingNotesEmailInput) => {
      const result = await meetingNotesApi.sendEmail(meetingId, input);
      return { ...result, format: input.format };
    },
  });
}
