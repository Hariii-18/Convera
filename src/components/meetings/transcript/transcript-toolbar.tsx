import * as React from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type TranscriptToolbarProps = React.ComponentProps<"div"> & {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  editMode?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  /** Pre-counted word total, shown as-is. */
  wordCount?: number;
  /** Full transcript text, used by the copy button. */
  transcriptText?: string;
  onCopy?: () => void;
};

/**
 * Action bar for the transcript: search, word count, edit toggle, and copy.
 * Every action is a callback into the caller — this component holds no
 * transcript state of its own.
 */
function TranscriptToolbar({
  className,
  searchValue = "",
  onSearchChange,
  editMode = false,
  onEditModeChange,
  wordCount,
  transcriptText = "",
  onCopy,
  ...props
}: TranscriptToolbarProps) {
  return (
    <div
      data-slot="transcript-toolbar"
      className={cn("flex flex-wrap items-center gap-3 px-4 py-3", className)}
      {...props}
    >
      <SearchInput
        value={searchValue}
        onChange={(event) => onSearchChange?.(event.target.value)}
        onClear={onSearchChange ? () => onSearchChange("") : undefined}
        placeholder="Search transcript…"
        containerClassName="max-w-xs"
        aria-label="Search transcript"
      />

      {wordCount !== undefined && (
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {wordCount.toLocaleString("en-US")} words
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant={editMode ? "secondary" : "outline"}
          size="sm"
          aria-pressed={editMode}
          onClick={() => onEditModeChange?.(!editMode)}
          disabled={!onEditModeChange}
        >
          <Pencil data-icon="inline-start" />
          {editMode ? "Editing" : "Edit"}
        </Button>

        <Separator orientation="vertical" className="h-5" />

        <CopyButton text={transcriptText} label="Copy" onCopy={onCopy} />
      </div>
    </div>
  );
}

export { TranscriptToolbar };
export type { TranscriptToolbarProps };
