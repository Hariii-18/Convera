import { apiClient } from "@/lib/api-client";
import type { TimelineResponse } from "@/features/timeline/types";

export const timelineApi = {
  /**
   * Always resolves with a (possibly empty) event list for an owned
   * meeting — an unprocessed meeting or a provider that produced no events
   * is `events: []`, not a 404. Only an unowned/nonexistent meeting id
   * rejects.
   */
  async getByMeeting(meetingId: string): Promise<TimelineResponse> {
    const { data } = await apiClient.get<TimelineResponse>(
      `/meetings/${meetingId}/timeline`,
    );
    return data;
  },
};
