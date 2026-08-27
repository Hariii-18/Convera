import type {
  LiveMeetingSessionResponse,
  LiveSessionState,
} from "@/features/live-meetings/types";

export type LiveMeetingSession = {
  id: string;
  meetingId: string;
  title: string;
  state: LiveSessionState;
  startedAt: string;
  stoppedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  errorMessage: string | null;
};

export function toLiveMeetingSession(
  response: LiveMeetingSessionResponse,
): LiveMeetingSession {
  return {
    id: response.id,
    meetingId: response.meeting_id,
    title: response.title,
    state: response.state,
    startedAt: response.started_at,
    stoppedAt: response.stopped_at,
    endedAt: response.ended_at,
    durationSeconds: response.duration_seconds,
    errorMessage: response.error_message,
  };
}
