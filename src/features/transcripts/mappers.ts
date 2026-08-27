import type {
  TranscriptResponse,
  TranscriptSegmentResponse,
} from "@/features/transcripts/types";
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
  /** Readability-cleaned transcript text, or `null` if not generated yet. */
  normalizedText: string | null;
  /** `null` until a normalized transcript has been generated for this meeting. */
  normalizedBlocks: TranscriptBlockData[] | null;
  normalizedAt: string | null;
  /** Translated transcript text, or `null` if not generated yet. */
  translatedText: string | null;
  /** `null` until a translation has been generated for this meeting. */
  translatedBlocks: TranscriptBlockData[] | null;
  /** The language `translatedText`/`translatedBlocks` are in, or `null` if none cached. */
  translatedLanguage: string | null;
  translatedAt: string | null;
};

/**
 * Segment timestamps are an enhancement, not a precondition for having a
 * transcript: a 200 response can carry full `transcript` text with an empty
 * `segments` array (e.g. no segment-level timing was produced). Falling back
 * to a single untimed block keeps that text visible instead of the viewer
 * treating a valid response as "no transcript yet".
 */
function toBlocks(
  transcriptId: string,
  segments: TranscriptSegmentResponse[],
  fallbackText: string,
): TranscriptBlockData[] {
  if (segments.length === 0) {
    return fallbackText.trim().length > 0
      ? [{ id: `${transcriptId}-0`, timestampSeconds: 0, text: fallbackText }]
      : [];
  }
  return segments.map((segment, index) => ({
    id: `${transcriptId}-${index}`,
    timestampSeconds: Math.round(segment.start),
    text: segment.text,
    speaker: segment.speaker_name
      ? { id: segment.speaker_key ?? segment.speaker_name, name: segment.speaker_name }
      : undefined,
  }));
}

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
    blocks: toBlocks(response.id, response.segments, response.transcript),
    normalizedText: response.normalized_transcript,
    normalizedBlocks: response.normalized_segments
      ? toBlocks(response.id, response.normalized_segments, response.normalized_transcript ?? "")
      : null,
    normalizedAt: response.normalized_at,
    translatedText: response.translated_transcript,
    translatedBlocks: response.translated_segments
      ? toBlocks(response.id, response.translated_segments, response.translated_transcript ?? "")
      : null,
    translatedLanguage: response.translated_language,
    translatedAt: response.translated_at,
  };
}
