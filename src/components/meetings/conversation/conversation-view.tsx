"use client";

import * as React from "react";
import { MessagesSquare } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { TranscriptSkeleton } from "@/components/meetings/transcript/transcript-skeleton";
import { ConversationTurn } from "@/components/meetings/conversation/conversation-turn";
import { groupIntoTurns } from "@/components/meetings/conversation/group-into-turns";
import { cn } from "@/lib/utils";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";

type ConversationViewProps = React.ComponentProps<"div"> & {
  blocks?: TranscriptBlockData[];
  isLoading?: boolean;
  onTimestampClick?: (seconds: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonCount?: number;
};

/**
 * The transcript re-read as a conversation: consecutive segments from the
 * same speaker collapse into one turn instead of one row per timestamp.
 * Renders straight off `blocks` — the same speaker-resolved data the
 * Transcript tab uses — so nothing here re-fetches or re-resolves speakers,
 * and a transcript with no `speaker_key` at all (legacy) still renders,
 * each segment simply landing in its own unattributed turn.
 */
function ConversationView({
  className,
  blocks = [],
  isLoading = false,
  onTimestampClick,
  emptyTitle = "No transcript yet",
  emptyDescription = "Once this meeting is transcribed, the conversation will appear here.",
  skeletonCount = 6,
  ...props
}: ConversationViewProps) {
  const turns = React.useMemo(() => groupIntoTurns(blocks), [blocks]);

  return (
    <div
      data-slot="conversation-view"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <div className="max-h-[32rem] overflow-y-auto">
          <span role="status" className="sr-only">
            Loading conversation&hellip;
          </span>
          <TranscriptSkeleton count={skeletonCount} />
        </div>
      ) : turns.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare />}
          title={emptyTitle}
          description={emptyDescription}
          className="rounded-none border-0"
        />
      ) : (
        <div
          role="list"
          aria-label="Conversation"
          className="max-h-[32rem] divide-y divide-border overflow-y-auto"
        >
          {turns.map((turn) => (
            <div key={turn.id} role="listitem">
              <ConversationTurn turn={turn} onTimestampClick={onTimestampClick} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { ConversationView };
export type { ConversationViewProps };
