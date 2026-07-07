import type { TranscriptResponse } from "@/features/transcripts/types";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";

export type Transcript = {
  id: string;
  meetingId: string;
  uploadId: string;
  language: string | null;
  text: string;
  duration: number | null;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  blocks: TranscriptBlockData[];
};

export function toTranscript(response: TranscriptResponse): Transcript {
  return {
    id: response.id,
    meetingId: response.meeting_id,
    uploadId: response.upload_id,
    language: response.language,
    text: response.transcript,
    duration: response.duration,
    wordCount: response.word_count,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    blocks: response.segments.map((segment, index) => ({
      id: `${response.id}-${index}`,
      timestampSeconds: Math.round(segment.start),
      text: segment.text,
    })),
  };
}
