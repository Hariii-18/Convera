/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * transcripts feature. See `@/features/transcripts/mappers` for the UI-shaped
 * types these get mapped into.
 */

export type TranscriptSegmentResponse = {
  start: number;
  end: number;
  text: string;
  /** Stable diarization-assigned key (`speaker_1`, ...), `null` when this
   * segment has no reliable speaker attribution. Never a display name. */
  speaker_key?: string | null;
  /** `speaker_key` resolved to the current `MeetingSpeaker.display_name` —
   * `Speaker N` if no speaker row exists for the key, `null` when
   * `speaker_key` itself is `null`. Resolved fresh on every read, never
   * stored. */
  speaker_name?: string | null;
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
  normalized_transcript: string | null;
  normalized_segments: TranscriptSegmentResponse[] | null;
  normalized_at: string | null;
  translated_transcript: string | null;
  translated_segments: TranscriptSegmentResponse[] | null;
  translated_language: string | null;
  translated_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Formats the Conversation export endpoint renders — PDF/DOCX only for now. */
export type ConversationExportFormat = "pdf" | "docx";

/** Body for `POST /transcripts/{meeting_id}/conversation/email`. `send_to_me`
 * and `recipients` are merged and deduplicated server-side into the final
 * send list — see `backend/app/services/conversation_email_service.py`. */
export type ConversationEmailRequest = {
  format: ConversationExportFormat;
  send_to_me: boolean;
  recipients: string[];
};

export type ConversationEmailResponse = {
  sent: boolean;
  recipients: string[];
};

/** Languages the translation layer supports; matches the backend's `TranslationLanguage`. */
export type TranslationLanguage = "en" | "hi" | "te";

export const TRANSLATION_LANGUAGES: { value: TranslationLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "te", label: "Telugu" },
];
