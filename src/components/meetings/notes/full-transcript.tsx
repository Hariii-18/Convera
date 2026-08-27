import * as React from "react";
import { FileText } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TranscriptBlock } from "@/components/meetings/transcript/transcript-block";
import { cn } from "@/lib/utils";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";

type FullTranscriptProps = React.ComponentProps<"div"> & {
  transcript?: string;
  /** Same segments backing Detailed Discussion above, reused here purely for
   * speaker names — when none of them carry a speaker (transcripts that
   * predate diarization), falls back to rendering `transcript` as one
   * contiguous block exactly as before. */
  blocks?: TranscriptBlockData[];
  loading?: boolean;
  onCopy?: () => void;
  onTimestampClick?: (seconds: number) => void;
};

/**
 * Runs consecutive same-speaker blocks together so a multi-line turn shows
 * the speaker's name once instead of on every line.
 */
function groupBySpeaker(blocks: TranscriptBlockData[]): TranscriptBlockData[][] {
  const groups: TranscriptBlockData[][] = [];
  for (const block of blocks) {
    const previousGroup = groups.at(-1);
    const previousBlock = previousGroup?.at(-1);
    if (previousGroup && block.speaker && previousBlock?.speaker?.id === block.speaker.id) {
      previousGroup.push(block);
    } else {
      groups.push([block]);
    }
  }
  return groups;
}

/**
 * The full transcript underlying this meeting's notes, verbatim — the
 * normalized transcript when one exists, otherwise the raw transcript
 * (same precedence the Transcript tab uses). Shows the resolved speaker
 * name per segment (grouping consecutive turns) when `blocks` carries
 * speaker data; otherwise renders as one contiguous block, distinct from
 * Detailed Discussion above.
 */
function FullTranscript({
  className,
  transcript,
  blocks = [],
  loading = false,
  onCopy,
  onTimestampClick,
  ...props
}: FullTranscriptProps) {
  const hasSpeakers = blocks.some((block) => block.speaker);

  return (
    <Card data-slot="full-transcript" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Full Transcript</CardTitle>
        {transcript && (
          <CardAction>
            <CopyButton text={transcript} label="Copy Transcript" onCopy={onCopy} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        ) : !transcript ? (
          <EmptyState
            icon={<FileText />}
            title="No transcript yet"
            description="Once this meeting is transcribed, the full transcript will appear here."
          />
        ) : hasSpeakers ? (
          <div
            role="list"
            aria-label="Full transcript"
            className="flex max-h-[28rem] flex-col divide-y divide-border overflow-y-auto"
          >
            {groupBySpeaker(blocks).map((group, groupIndex) => (
              <div key={group[0]?.id ?? groupIndex} role="listitem">
                {group.map((block, index) => (
                  <TranscriptBlock
                    key={block.id}
                    block={index === 0 ? block : { ...block, speaker: undefined }}
                    onTimestampClick={onTimestampClick}
                    className={index > 0 ? "pt-0" : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {transcript}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { FullTranscript };
export type { FullTranscriptProps };
