import * as React from "react";
import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DownloadButton } from "@/components/meetings/downloads/download-button";
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
  /** Presentational only for this phase — SMTP delivery isn't implemented
   * yet, so the caller just surfaces "coming soon" or similar. */
  onSendEmail?: () => void;
  sendingEmail?: boolean;
};

/**
 * Export control for Meeting Notes: pick a format, then Download (renders
 * the currently saved Meeting Notes server-side and saves the file) or Send
 * to Email (scaffolded for the architecture — see `onSendEmail`, delivery
 * isn't wired up yet).
 */
function MeetingNotesExportControl({
  className,
  format,
  onFormatChange,
  onDownload,
  downloading = false,
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

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSendEmail}
          disabled={!onSendEmail || sendingEmail}
        >
          {sendingEmail ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Mail data-icon="inline-start" />
          )}
          Send to Email
        </Button>
      </div>
    </div>
  );
}

export { MeetingNotesExportControl };
export type { MeetingNotesExportControlProps };
