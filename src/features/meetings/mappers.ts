import type { Meeting } from "@/components/meetings/types";
import type { MeetingResponse } from "@/features/meetings/types";

export function toMeeting(response: MeetingResponse): Meeting {
  return {
    id: response.id,
    title: response.title,
    status: response.status,
    sourceType: response.source_type,
    durationSeconds: response.duration_seconds,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    participantCount: response.participants_count ?? undefined,
  };
}
