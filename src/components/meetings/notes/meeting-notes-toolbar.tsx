import * as React from "react";
import { Clock, Loader2, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { formatReadingTime } from "@/components/meetings/summary/format";
import { cn } from "@/lib/utils";

type MeetingNotesToolbarProps = React.ComponentProps<"div"> & {
  /** Flattened notes text, used by the copy button. */
  notesText?: string;
  wordCount?: number;
  onCopy?: () => void;
  /** Whether the document is currently in edit mode. Omit `onEdit` to hide
   * the whole Edit/Save/Cancel group (e.g. while notes are still loading). */
  editMode?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
};

/**
 * Action bar for Meeting Notes: an estimated reading time, the Edit/Save/
 * Cancel document-editing controls, and a copy action for the summary
 * portion (Executive Summary through Next Steps). Detailed Discussion and
 * Full Transcript have their own copy actions.
 */
function MeetingNotesToolbar({
  className,
  notesText = "",
  wordCount,
  onCopy,
  editMode = false,
  onEdit,
  onSave,
  onCancel,
  saving = false,
  ...props
}: MeetingNotesToolbarProps) {
  return (
    <div
      data-slot="meeting-notes-toolbar"
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

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {onEdit &&
          (editMode ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
                <X data-icon="inline-start" />
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={onSave} disabled={saving}>
                {saving ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : null}
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
          ))}

        <CopyButton text={notesText} label="Copy Notes" onCopy={onCopy} />
      </div>
    </div>
  );
}

export { MeetingNotesToolbar };
export type { MeetingNotesToolbarProps };
