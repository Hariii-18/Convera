import axios from "axios";

import { apiClient } from "@/lib/api-client";
import type {
  TranscriptResponse,
  TranslationLanguage,
} from "@/features/transcripts/types";

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

  /** Generates (or regenerates) the readability-normalized transcript. */
  async normalize(meetingId: string): Promise<TranscriptResponse> {
    const { data } = await apiClient.post<TranscriptResponse>("/transcripts/normalize", {
      meeting_id: meetingId,
    });
    return data;
  },

  /** Generates (or regenerates) the transcript translated into `targetLanguage`. */
  async translate(
    meetingId: string,
    targetLanguage: TranslationLanguage,
  ): Promise<TranscriptResponse> {
    const { data } = await apiClient.post<TranscriptResponse>("/transcripts/translate", {
      meeting_id: meetingId,
      target_language: targetLanguage,
    });
    return data;
  },
};
