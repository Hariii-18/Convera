import * as React from "react";

import { cn } from "@/lib/utils";
import { Timestamp } from "@/components/meetings/transcript/timestamp";
import { splitHighlight } from "@/components/meetings/format";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";

type TranscriptBlockProps = React.ComponentProps<"div"> & {
  block: TranscriptBlockData;
  /** Case-insensitive term to highlight within the block's text. UI only. */
  searchTerm?: string;
  onTimestampClick?: (seconds: number) => void;
  /** Renders the text as an editable, auto-growing textarea. Controlled by the caller. */
  editable?: boolean;
  onTextChange?: (text: string) => void;
};

/**
 * A single timestamped line of the transcript: timestamp, optional speaker,
 * and text. Read-only by default; `editable` swaps the text for a
 * controlled textarea so the parent owns the actual edit.
 */
function TranscriptBlock({
  className,
  block,
  searchTerm,
  onTimestampClick,
  editable = false,
  onTextChange,
  ...props
}: TranscriptBlockProps) {
  const segments = splitHighlight(block.text, searchTerm);

  return (
    <div
      data-slot="transcript-block"
      role="listitem"
      className={cn("flex gap-3 px-4 py-3", className)}
      {...props}
    >
      <Timestamp
        seconds={block.timestampSeconds}
        onClick={onTimestampClick ? () => onTimestampClick(block.timestampSeconds) : undefined}
        className="mt-0.5"
      />

      <div className="min-w-0 flex-1">
        {block.speaker && (
          <p className="mb-1 text-sm font-medium text-foreground">
            {block.speaker.name}
          </p>
        )}

        {editable ? (
          <textarea
            value={block.text}
            onChange={(event) => onTextChange?.(event.target.value)}
            rows={1}
            aria-label={
              block.speaker
                ? `Edit ${block.speaker.name}'s line at ${block.timestampSeconds} seconds`
                : `Edit transcript line at ${block.timestampSeconds} seconds`
            }
            className="field-sizing-content w-full resize-none rounded-md border border-input bg-transparent px-2 py-1 text-sm leading-relaxed text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {segments.map((segment, index) =>
              segment.matched ? (
                <mark
                  key={index}
                  className="rounded-sm bg-warning/30 text-foreground dark:bg-warning/25"
                >
                  {segment.text}
                </mark>
              ) : (
                <React.Fragment key={index}>{segment.text}</React.Fragment>
              ),
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export { TranscriptBlock };
export type { TranscriptBlockProps };
