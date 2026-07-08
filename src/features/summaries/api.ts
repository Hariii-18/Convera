import axios from "axios";

import { apiClient } from "@/lib/api-client";
import type { SummaryResponse } from "@/features/summaries/types";

export const summariesApi = {
  /** Returns `null` when the meeting has no summary yet (404) rather than throwing. */
  async getByMeeting(meetingId: string): Promise<SummaryResponse | null> {
    try {
      const { data } = await apiClient.get<SummaryResponse>("/summaries", {
        params: { meeting_id: meetingId },
      });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /** Runs the Local Summary Engine against the meeting's transcript. */
  async generate(meetingId: string): Promise<SummaryResponse> {
    const { data } = await apiClient.post<SummaryResponse>("/summaries", {
      meeting_id: meetingId,
    });
    return data;
  },
};
