import { apiClient } from "@/lib/api-client";
import type { MeetingInsightsResponse } from "@/features/insights/types";

export const insightsApi = {
  /**
   * Always resolves with a (possibly all-empty) insights payload for an
   * owned meeting — a meeting with no Summary yet is `has_summary: false`
   * with empty sections, not a 404. Only an unowned/nonexistent meeting id
   * rejects.
   */
  async getByMeeting(meetingId: string): Promise<MeetingInsightsResponse> {
    const { data } = await apiClient.get<MeetingInsightsResponse>(
      `/meetings/${meetingId}/insights`,
    );
    return data;
  },
};
