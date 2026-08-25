import type {
  TranscriptBlockData,
  TranscriptSpeaker,
} from "@/components/meetings/transcript/types";

/**
 * One or more consecutive `TranscriptBlockData` from the same speaker,
 * collapsed into a single conversational turn. `blocks` keeps each
 * underlying segment's exact text and timestamp intact — grouping never
 * rewrites or merges the text itself.
 */
export type ConversationTurn = {
  /** Id of the first block in the turn. */
  id: string;
  /** Omitted for legacy segments that never resolved a speaker. */
  speaker?: TranscriptSpeaker;
  /** Seconds from the start of the meeting — the first block's timestamp. */
  timestampSeconds: number;
  blocks: TranscriptBlockData[];
};
