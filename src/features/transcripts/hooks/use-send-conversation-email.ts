"use client";

import { useMutation } from "@tanstack/react-query";

import { transcriptsApi } from "@/features/transcripts/api";
import type { ConversationExportFormat } from "@/features/transcripts/types";

export type SendConversationEmailInput = {
  format: ConversationExportFormat;
  sendToMe: boolean;
  recipients: string[];
};

/** Emails the meeting's Conversation export (transcript rendered as speaker
 * dialogue) as `format` to every resolved recipient. Mirrors
 * `useSendMeetingNotesEmail` — `useMutation`'s `isPending` doubles as the
 * duplicate-click guard, the caller disables the Send button while a send
 * is in flight.
 */
export function useSendConversationEmail(meetingId: string) {
  return useMutation({
    mutationFn: async (input: SendConversationEmailInput) => {
      const result = await transcriptsApi.sendConversationEmail(meetingId, input);
      return { ...result, format: input.format };
    },
  });
}
