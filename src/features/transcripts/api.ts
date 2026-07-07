import axios from "axios";

import { apiClient } from "@/lib/api-client";
import type { TranscriptResponse } from "@/features/transcripts/types";

export const transcriptsApi = {
  /** Returns `null` when the meeting has no transcript yet (404) rather than throwing. */
  async getByMeeting(meetingId: string): Promise<TranscriptResponse | null> {
    try {
      const { data } = await apiClient.get<TranscriptResponse>("/transcripts", {
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
};
