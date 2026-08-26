"use client";

import { useMutation } from "@tanstack/react-query";

import { summariesApi } from "@/features/summaries/api";
import type { SummaryExportFormat } from "@/features/summaries/types";

export type SendSummaryEmailInput = {
  format: SummaryExportFormat;
  sendToMe: boolean;
  recipients: string[];
};

/** Emails the current saved Summary as `format` to every resolved recipient
 * (the authenticated user's own address when `sendToMe`, plus
 * `recipients`). `useMutation`'s `isPending` doubles as the duplicate-click
 * guard — the caller disables the Send button while a send is in flight.
 */
export function useSendSummaryEmail(meetingId: string) {
  return useMutation({
    mutationFn: async (input: SendSummaryEmailInput) => {
      const result = await summariesApi.sendEmail(meetingId, input);
      return { ...result, format: input.format };
    },
  });
}
