import * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Timestamp } from "@/components/meetings/transcript/timestamp";
import { cn } from "@/lib/utils";
import type { ConversationTurn as ConversationTurnData } from "@/components/meetings/conversation/types";

const AVATAR_PALETTE = [
  "bg-chart-1 text-background",
  "bg-chart-2 text-background",
  "bg-chart-3 text-background",
  "bg-chart-4 text-background",
  "bg-chart-5 text-background",
] as const;

/** Deterministic pick from `AVATAR_PALETTE` so the same speaker id always gets the same color. */
function speakerColorClass(speakerId: string) {
  let hash = 0;
  for (let index = 0; index < speakerId.length; index += 1) {
    hash = (hash * 31 + speakerId.charCodeAt(index)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase();
}

type ConversationTurnProps = React.ComponentProps<"div"> & {
  turn: ConversationTurnData;
  onTimestampClick?: (seconds: number) => void;
  /** Highlights this turn as the one currently playing. */
  isActive?: boolean;
};

/**
 * One speaker turn: avatar and a jump-to-timestamp control sit above the
 * text as secondary/navigation chrome. The speaker name itself is repeated
 * as a "Speaker: " prefix on every underlying segment (not just once per
 * turn), so the visible conversation format never depends on the timestamp
 * or the avatar to tell who's speaking on a given line — each segment keeps
 * its own exact text and order.
 */
function ConversationTurn({
  className,
  turn,
  onTimestampClick,
  isActive = false,
  ...props
}: ConversationTurnProps) {
  const speakerName = turn.speaker?.name;

  return (
    <div
      data-slot="conversation-turn"
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors",
        isActive && "bg-primary/5",
        className,
      )}
      {...props}
    >
      <Avatar size="sm" className="mt-0.5">
        <AvatarFallback
          className={cn(
            speakerName && turn.speaker
              ? speakerColorClass(turn.speaker.id)
              : "bg-muted text-muted-foreground",
          )}
        >
          {speakerName ? initials(speakerName) : "—"}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Timestamp
            seconds={turn.timestampSeconds}
            onClick={
              onTimestampClick ? () => onTimestampClick(turn.timestampSeconds) : undefined
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          {turn.blocks.map((block) => (
            <p
              key={block.id}
              className="text-sm leading-relaxed whitespace-pre-wrap text-foreground"
            >
              {speakerName && (
                <span className="font-medium text-foreground">{speakerName}: </span>
              )}
              {block.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export { ConversationTurn };
export type { ConversationTurnProps };
