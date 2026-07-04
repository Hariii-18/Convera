"use client";

import * as React from "react";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { TranscriptBlock } from "@/components/meetings/transcript/transcript-block";
import { TranscriptToolbar } from "@/components/meetings/transcript/transcript-toolbar";
import { TranscriptSkeleton } from "@/components/meetings/transcript/transcript-skeleton";
import { countWords } from "@/components/meetings/format";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";

type TranscriptViewerProps = React.ComponentProps<"div"> & {
  blocks?: TranscriptBlockData[];
  isLoading?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Controlled — the caller owns whether edit mode is on. */
  editMode?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  /** Controlled — the caller owns the transcript data and applies the edit. */
  onBlockTextChange?: (blockId: string, text: string) => void;
  onTimestampClick?: (seconds: number) => void;
  onCopy?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonCount?: number;
};

/**
 * Production-ready transcript viewer: toolbar (search, word count, edit
 * toggle, copy) over a scrollable list of timestamped blocks. Every block
 * renders from `blocks` alone — no API calls, no generated text, no fake
 * placeholder transcript.
 *
 * Rendered as a flat, keyed list inside a single scroll container so a
 * windowing library (react-window, virtua, etc.) can be dropped in later
 * without changing the surrounding architecture. Not virtualized yet.
 */
function TranscriptViewer({
  className,
  blocks = [],
  isLoading = false,
  searchValue,
  onSearchChange,
  editMode = false,
  onEditModeChange,
  onBlockTextChange,
  onTimestampClick,
  onCopy,
  emptyTitle = "No transcript yet",
  emptyDescription = "Once this meeting is transcribed, the full transcript will appear here.",
  skeletonCount = 6,
  ...props
}: TranscriptViewerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const previousBlockCount = React.useRef(blocks.length);

  const transcriptText = React.useMemo(
    () =>
      blocks
        .map((block) =>
          block.speaker ? `${block.speaker.name}: ${block.text}` : block.text,
        )
        .join("\n\n"),
    [blocks],
  );

  const wordCount = React.useMemo(
    () => countWords(blocks.map((block) => block.text).join(" ")),
    [blocks],
  );

  React.useEffect(() => {
    const container = scrollRef.current;
    const grew = blocks.length > previousBlockCount.current;
    previousBlockCount.current = blocks.length;
    if (!container || !grew) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 120) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [blocks.length]);

  return (
    <div
      data-slot="transcript-viewer"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      <TranscriptToolbar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        editMode={editMode}
        onEditModeChange={onEditModeChange}
        wordCount={blocks.length > 0 ? wordCount : undefined}
        transcriptText={transcriptText}
        onCopy={onCopy}
        className="border-b border-border"
      />

      {isLoading ? (
        <div className="max-h-[32rem] overflow-y-auto">
          <span role="status" className="sr-only">
            Loading transcript&hellip;
          </span>
          <TranscriptSkeleton count={skeletonCount} />
        </div>
      ) : blocks.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={emptyTitle}
          description={emptyDescription}
          className="rounded-none border-0"
        />
      ) : (
        <div
          ref={scrollRef}
          role="list"
          aria-label="Transcript"
          className="max-h-[32rem] divide-y divide-border overflow-y-auto"
        >
          {blocks.map((block) => (
            <TranscriptBlock
              key={block.id}
              block={block}
              searchTerm={searchValue}
              editable={editMode}
              onTimestampClick={onTimestampClick}
              onTextChange={
                onBlockTextChange
                  ? (text) => onBlockTextChange(block.id, text)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { TranscriptViewer };
export type { TranscriptViewerProps };
