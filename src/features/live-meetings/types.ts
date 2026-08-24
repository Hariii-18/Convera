/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * live-meetings feature. See `@/features/live-meetings/mappers` for the
 * UI-shaped `LiveMeetingSession` type these get mapped into.
 */

export type LiveSessionState =
  | "live"
  | "stopping"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";

export type LiveMeetingSessionResponse = {
  id: string;
  meeting_id: string;
  title: string;
  state: LiveSessionState;
  started_at: string;
  stopped_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript_id: string | null;
  processing_job_id: string | null;
  processing_job_status: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type LiveMeetingStartPayload = {
  title: string;
};
