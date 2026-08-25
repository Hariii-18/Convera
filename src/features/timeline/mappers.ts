import type { TimelineResponse } from "@/features/timeline/types";
import type { TimelineEventData } from "@/components/meetings/timeline/types";

export function toTimelineEvents(response: TimelineResponse): TimelineEventData[] {
  return response.events.map((event, index) => ({
    id: `${response.meeting_id}-event-${index}`,
    timestampSeconds: event.start,
    title: event.title,
    description: event.description ?? undefined,
  }));
}
