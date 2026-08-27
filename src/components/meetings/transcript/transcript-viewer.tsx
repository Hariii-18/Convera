"use client";

import * as React from "react";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { TranscriptBlock } from "@/components/meetings/transcript/transcript-block";
import { TranscriptToolbar } from "@/components/meetings/transcript/transcript-toolbar";
import { TranscriptSkeleton } from "@/components/meetings/transcript/transcript-skeleton";
import { countWords } from "@/components/meetings/format";
import { findActiveTimestampId } from "@/features/media-player/active-item";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";
import type { TranslationLanguage } from "@/features/transcripts/types";

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
  /** Persists the current edits. Omit to fall back to a plain on/off edit
   * toggle with no Save/Cancel step. */
  onSave?: () => void;
  saving?: boolean;
  onTimestampClick?: (seconds: number) => void;
  onCopy?: () => void;
  /** Current playback position, while playing — highlights the block at or
   * before this time. Omit (or leave undefined while paused) to show no
   * highlight. */
  activeTimeSeconds?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  skeletonCount?: number;
  /** Which transcript variant is currently shown. Omit to hide the raw/normalized/translated toggle. */
  view?: "raw" | "normalized" | "translated";
  onViewChange?: (view: "raw" | "normalized" | "translated") => void;
  /** Whether a normalized transcript has been generated for this meeting yet. */
  hasNormalized?: boolean;
  isNormalizing?: boolean;
  onGenerateNormalized?: () => void;
  /** Whether a translation into `translationLanguage` has been generated yet. */
  hasTranslated?: boolean;
  isTranslating?: boolean;
  translationLanguage?: TranslationLanguage;
  onTranslationLanguageChange?: (language: TranslationLanguage) => void;
  onGenerateTranslation?: () => void;
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
  onSave,
  saving = false,
  onTimestampClick,
  onCopy,
  activeTimeSeconds,
  emptyTitle = "No transcript yet",
  emptyDescription = "Once this meeting is transcribed, the full transcript will appear here.",
  emptyAction,
  skeletonCount = 6,
  view,
  onViewChange,
  hasNormalized = false,
  isNormalizing = false,
  onGenerateNormalized,
  hasTranslated = false,
  isTranslating = false,
  translationLanguage,
  onTranslationLanguageChange,
  onGenerateTranslation,
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

  const activeBlockId = React.useMemo(
    () =>
      activeTimeSeconds === undefined
        ? undefined
        : findActiveTimestampId(blocks, activeTimeSeconds),
    [blocks, activeTimeSeconds],
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
        onSave={onSave}
        saving={saving}
        wordCount={blocks.length > 0 ? wordCount : undefined}
        transcriptText={transcriptText}
        onCopy={onCopy}
        view={view}
        onViewChange={onViewChange}
        hasNormalized={hasNormalized}
        isNormalizing={isNormalizing}
        onGenerateNormalized={onGenerateNormalized}
        hasTranslated={hasTranslated}
        isTranslating={isTranslating}
        translationLanguage={translationLanguage}
        onTranslationLanguageChange={onTranslationLanguageChange}
        onGenerateTranslation={onGenerateTranslation}
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
          action={emptyAction}
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
            <div key={block.id} role="listitem">
              <TranscriptBlock
                block={block}
                searchTerm={searchValue}
                editable={editMode}
                onTimestampClick={onTimestampClick}
                isActive={block.id === activeBlockId}
                onTextChange={
                  onBlockTextChange
                    ? (text) => onBlockTextChange(block.id, text)
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { TranscriptViewer };
export type { TranscriptViewerProps };
