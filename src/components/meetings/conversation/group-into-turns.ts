import type { TranscriptBlockData } from "@/components/meetings/transcript/types";
import type { ConversationTurn } from "@/components/meetings/conversation/types";

/**
 * Runs consecutive same-speaker blocks together into one conversational
 * turn. Comparison is by speaker id (the stable `speaker_key`, falling back
 * to the resolved name), so a speaker who returns later — after someone else
 * has spoken — starts a new turn instead of rejoining their earlier one.
 *
 * Blocks without a resolved speaker (legacy transcripts predating
 * `speaker_key`, or unattributed segments) each become their own turn
 * rather than merging, the same "no speaker" treatment `TranscriptBlock`
 * already gives them.
 */
export function groupIntoTurns(blocks: TranscriptBlockData[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  for (const block of blocks) {
    const previous = turns.at(-1);
    if (previous && block.speaker && previous.speaker?.id === block.speaker.id) {
      previous.blocks.push(block);
    } else {
      turns.push({
        id: block.id,
        speaker: block.speaker,
        timestampSeconds: block.timestampSeconds,
        blocks: [block],
      });
    }
  }

  return turns;
}
