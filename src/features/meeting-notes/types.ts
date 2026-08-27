/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * meeting-notes feature. See `@/features/meeting-notes/mappers` for the
 * UI-shaped types these get mapped into.
 *
 * Mirrors `MeetingNotesRead`/`MeetingNotesUpdate` in
 * `backend/app/schemas/meeting_notes.py`.
 */

export type MeetingNotesTopicResponse = {
  title: string;
  description: string | null;
};

export type MeetingNotesTextItemResponse = {
  text: string;
};

export type MeetingNotesActionItemResponse = {
  text: string;
  owner: string | null;
  due_date: string | null;
  status: string | null;
};

export type MeetingNotesSegmentResponse = {
  start: number;
  end: number;
  text: string;
  /** Stable diarization-assigned key (`speaker_1`, ...), `null` when this
   * segment has no reliable speaker attribution. Never a display name. */
  speaker_key?: string | null;
  /** `speaker_key` resolved to the current `MeetingSpeaker.display_name` —
   * `Speaker N` if no speaker row exists for the key, `null` when
   * `speaker_key` itself is `null`. Resolved fresh on every read, never
   * stored — never sent back on `PATCH /meeting-notes`. */
  speaker_name?: string | null;
};

export type MeetingNotesResponse = {
  id: string;
  meeting_id: string;
  title: string;
  date_time_utc: string;
  /** Pre-formatted "YYYY-MM-DD HH:MM:SS TZ" string in Asia/Kolkata. */
  date_time_ist: string;
  duration_seconds: number | null;
  participants_count: number | null;
  executive_summary: string;
  discussion_topics: MeetingNotesTopicResponse[];
  decisions: MeetingNotesTextItemResponse[];
  action_items: MeetingNotesActionItemResponse[];
  risks: MeetingNotesTextItemResponse[];
  open_questions: MeetingNotesTextItemResponse[];
  next_steps: MeetingNotesTextItemResponse[];
  timestamped_discussion: MeetingNotesSegmentResponse[];
  full_transcript: string;
  created_at: string;
  updated_at: string;
};

/** Body for `PATCH /meeting-notes` — every field optional, only supplied ones change. */
export type MeetingNotesUpdateRequest = {
  title?: string;
  executive_summary?: string;
  discussion_topics?: MeetingNotesTopicResponse[];
  decisions?: MeetingNotesTextItemResponse[];
  action_items?: MeetingNotesActionItemResponse[];
  risks?: MeetingNotesTextItemResponse[];
  open_questions?: MeetingNotesTextItemResponse[];
  next_steps?: MeetingNotesTextItemResponse[];
  timestamped_discussion?: MeetingNotesSegmentResponse[];
};

export type MeetingNotesExportFormat = "pdf" | "docx" | "pptx";

/** Body for `POST /meeting-notes/{meeting_id}/email`. `send_to_me` and
 * `recipients` are merged and deduplicated server-side into the final send
 * list — see `backend/app/services/meeting_notes_email_service.py`. */
export type MeetingNotesEmailRequest = {
  format: MeetingNotesExportFormat;
  send_to_me: boolean;
  recipients: string[];
};

export type MeetingNotesEmailResponse = {
  sent: boolean;
  recipients: string[];
};
