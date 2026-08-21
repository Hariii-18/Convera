import { apiClient } from "@/lib/api-client";
import type {
  LiveMeetingSessionResponse,
  LiveMeetingStartPayload,
} from "@/features/live-meetings/types";

export const liveMeetingsApi = {
  async start(
    payload?: LiveMeetingStartPayload,
  ): Promise<LiveMeetingSessionResponse> {
    const { data } = await apiClient.post<LiveMeetingSessionResponse>(
      "/live-meetings/start",
      payload,
    );
    return data;
  },

  async get(meetingId: string): Promise<LiveMeetingSessionResponse> {
    const { data } = await apiClient.get<LiveMeetingSessionResponse>(
      `/live-meetings/${meetingId}`,
    );
    return data;
  },

  async stop(meetingId: string): Promise<LiveMeetingSessionResponse> {
    const { data } = await apiClient.post<LiveMeetingSessionResponse>(
      `/live-meetings/${meetingId}/stop`,
    );
    return data;
  },
};
