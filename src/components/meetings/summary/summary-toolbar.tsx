import * as React from "react";
import { Clock, Download, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MeetingNotesEmailDialog,
  type MeetingNotesEmailSendPayload,
} from "@/components/meetings/notes/meeting-notes-email-dialog";
import { formatReadingTime } from "@/components/meetings/summary/format";
import { cn } from "@/lib/utils";
import type { SummaryExportFormat } from "@/features/summaries/types";

const EXPORT_FORMAT_OPTIONS: { value: SummaryExportFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word (.docx)" },
  { value: "pptx", label: "PowerPoint (.pptx)" },
];

type SummaryToolbarProps = React.ComponentProps<"div"> & {
  /** Full summary text, used by the copy button. */
  summaryText?: string;
  /** Pre-counted word total across every section, used to derive reading time. */
  wordCount?: number;
  onCopy?: () => void;
  /** Renders the currently saved Summary tab content to `format` and saves
   * it to disk. Omit to disable the Export control entirely. */
  onExport?: (format: SummaryExportFormat) => void;
  /** Shows a spinner in place of the Export icon while a download is in flight. */
  exporting?: boolean;
  /** Presentational placeholder — the caller owns what regenerating actually does. */
  onRegenerate?: () => void;
  /** Format the "Send to Email" dialog will render and attach. */
  emailFormat?: SummaryExportFormat;
  onEmailFormatChange?: (format: SummaryExportFormat) => void;
  /** Authenticated user's own address, shown in the email dialog's "Send to
   * me" option. */
  ownEmail?: string;
  /** Emails the currently saved Summary (rendered to `emailFormat`) to the
   * resolved recipient list from the email dialog — never a regenerated
   * summary, never Meeting Notes. Omit to hide the Send to Email control
   * entirely. */
  onSendEmail?: (payload: MeetingNotesEmailSendPayload) => Promise<void>;
  sendingEmail?: boolean;
};

/**
 * Action bar for the meeting summary: copy, export (pick a format from a
 * menu), regenerate, and an estimated reading time. Every action is a
 * callback into the caller — this component holds no summary state of its
 * own.
 */
function SummaryToolbar({
  className,
  summaryText = "",
  wordCount,
  onCopy,
  onExport,
  exporting = false,
  onRegenerate,
  emailFormat = "pdf",
  onEmailFormatChange,
  ownEmail,
  onSendEmail,
  sendingEmail = false,
  ...props
}: SummaryToolbarProps) {
  return (
    <div
      data-slot="summary-toolbar"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      {wordCount !== undefined && (
        <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
          <Clock aria-hidden="true" className="size-3.5" />
          {formatReadingTime(wordCount)}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <CopyButton text={summaryText} label="Copy Summary" onCopy={onCopy} />

        <Separator orientation="vertical" className="h-5" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!onExport || exporting}
              />
            }
          >
            {exporting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {EXPORT_FORMAT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onExport?.(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={!onRegenerate}
        >
          <RefreshCw data-icon="inline-start" />
          Regenerate
        </Button>

        {onSendEmail && (
          <>
            <Separator orientation="vertical" className="h-5" />

            <Select
              value={emailFormat}
              onValueChange={(value) =>
                onEmailFormatChange?.(value as SummaryExportFormat)
              }
            >
              <SelectTrigger aria-label="Email format" className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <MeetingNotesEmailDialog
              title="Send Summary"
              description="Emails the currently saved Summary in the selected format. The summary is not regenerated before sending."
              ownEmail={ownEmail}
              sending={sendingEmail}
              onSend={onSendEmail}
            />
          </>
        )}
      </div>
    </div>
  );
}

export { SummaryToolbar };
export type { SummaryToolbarProps };
