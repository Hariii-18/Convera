/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * transcripts feature. See `@/features/transcripts/mappers` for the UI-shaped
 * types these get mapped into.
 */

export type TranscriptSegmentResponse = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptResponse = {
  id: string;
  meeting_id: string;
  upload_id: string;
  language: string | null;
  transcript: string;
  segments: TranscriptSegmentResponse[];
  duration: number | null;
  word_count: number;
  created_at: string;
  updated_at: string;
};
