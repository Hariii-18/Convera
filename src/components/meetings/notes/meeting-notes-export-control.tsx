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
import type { MeetingNotesExportFormat } from "@/features/meeting-notes/types";

const FORMAT_OPTIONS: { value: MeetingNotesExportFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word (.docx)" },
  { value: "pptx", label: "PowerPoint (.pptx)" },
];

type MeetingNotesExportControlProps = React.ComponentProps<"div"> & {
  format: MeetingNotesExportFormat;
  onFormatChange: (format: MeetingNotesExportFormat) => void;
  onDownload?: () => void;
  downloading?: boolean;
  /** Authenticated user's own address, shown in the email dialog's "Send to
   * me" option. */
  ownEmail?: string;
  /** Emails the currently saved Meeting Notes (rendered to `format`) to the
   * resolved recipient list from the email dialog. Omit to hide the Send to
   * Email control entirely. */
  onSendEmail?: (payload: MeetingNotesEmailSendPayload) => Promise<void>;
  sendingEmail?: boolean;
};

/**
 * Export control for Meeting Notes: pick a format, then Download (renders
 * the currently saved Meeting Notes server-side and saves the file) or Send
 * to Email (opens a small dialog to pick recipients, then renders the same
 * document server-side and emails it to all of them — see `onSendEmail`).
 */
function MeetingNotesExportControl({
  className,
  format,
  onFormatChange,
  onDownload,
  downloading = false,
  ownEmail,
  onSendEmail,
  sendingEmail = false,
  ...props
}: MeetingNotesExportControlProps) {
  return (
    <div
      data-slot="meeting-notes-export-control"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      <span className="text-sm font-medium text-foreground">Export</span>

      <Select
        value={format}
        onValueChange={(value) => onFormatChange(value as MeetingNotesExportFormat)}
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

      <div className="ml-auto flex items-center gap-2">
        <DownloadButton onClick={onDownload} loading={downloading} disabled={!onDownload}>
          Download
        </DownloadButton>

        {onSendEmail && (
          <MeetingNotesEmailDialog
            ownEmail={ownEmail}
            sending={sendingEmail}
            onSend={onSendEmail}
          />
        )}
      </div>
    </div>
  );
}

export { MeetingNotesExportControl };
export type { MeetingNotesExportControlProps };
