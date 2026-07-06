import type { MeetingStatus } from "@/components/meetings/types";
import type { MeetingSourceId } from "@/components/meetings/meeting-source";

/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * meetings feature. See `@/components/meetings/types` for the UI-shaped
 * `Meeting` type these get mapped into.
 */

export type MeetingResponse = {
  id: string;
  title: string;
  status: MeetingStatus;
  source_type: MeetingSourceId;
  duration_seconds: number | null;
  participants_count: number | null;
  created_at: string;
  updated_at: string;
};

export type MeetingCreatePayload = {
  title: string;
  source_type: MeetingSourceId;
};

export type MeetingUpdatePayload = {
  title?: string;
  status?: MeetingStatus;
};
