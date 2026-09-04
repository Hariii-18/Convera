import * as React from "react";

import { DownloadButton } from "@/components/meetings/downloads/download-button";
import {
  MeetingNotesEmailDialog,
  type MeetingNotesEmailSendPayload,
} from "@/components/meetings/notes/meeting-notes-email-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ConversationExportFormat } from "@/features/transcripts/types";

const FORMAT_OPTIONS: { value: ConversationExportFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word (.docx)" },
];

type ConversationExportControlProps = React.ComponentProps<"div"> & {
  format: ConversationExportFormat;
  onFormatChange: (format: ConversationExportFormat) => void;
  onDownload?: () => void;
  downloading?: boolean;
  /** Authenticated user's own address, shown in the email dialog's "Send to
   * me" option. */
  ownEmail?: string;
  /** Emails the meeting's Conversation export (rendered to `format`) to the
   * resolved recipient list from the email dialog. Omit to hide the Send to
   * Email control entirely. */
  onSendEmail?: (payload: MeetingNotesEmailSendPayload) => Promise<void>;
  sendingEmail?: boolean;
};

/**
 * Export control for the Conversation view: pick a format, then Download
 * (renders the meeting's transcript as speaker dialogue server-side and
 * saves the file) or Send to Email (opens the same recipient dialog Meeting
 * Notes uses, then renders and emails the same document — see
 * `onSendEmail`). Mirrors `MeetingNotesExportControl`'s layout for a
 * consistent export affordance across tabs.
 */
function ConversationExportControl({
  className,
  format,
  onFormatChange,
  onDownload,
  downloading = false,
  ownEmail,
  onSendEmail,
  sendingEmail = false,
  ...props
}: ConversationExportControlProps) {
  return (
    <div
      data-slot="conversation-export-control"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      <span className="text-sm font-medium text-foreground">Export</span>

      <Select
        value={format}
        onValueChange={(value) => onFormatChange(value as ConversationExportFormat)}
      >
        <SelectTrigger aria-label="Export format" className="h-8 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FORMAT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <DownloadButton onClick={onDownload} loading={downloading} disabled={!onDownload}>
          Download
        </DownloadButton>

        {onSendEmail && (
          <MeetingNotesEmailDialog
            title="Send Conversation"
            description="Emails the meeting's transcript, rendered as speaker dialogue, in the selected format."
            ownEmail={ownEmail}
            sending={sendingEmail}
            onSend={onSendEmail}
          />
        )}
      </div>
    </div>
  );
}

export { ConversationExportControl };
export type { ConversationExportControlProps };
