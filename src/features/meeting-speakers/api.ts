import { apiClient } from "@/lib/api-client";
import type {
  MeetingSpeakerCreateRequest,
  MeetingSpeakerResponse,
  MeetingSpeakerUpdateRequest,
} from "@/features/meeting-speakers/types";

export const meetingSpeakersApi = {
  async listByMeeting(meetingId: string): Promise<MeetingSpeakerResponse[]> {
    const { data } = await apiClient.get<MeetingSpeakerResponse[]>(
      "/meeting-speakers",
      {
        params: { meeting_id: meetingId },
      },
    );
    return data;
  },

  async create(
    meetingId: string,
    payload: MeetingSpeakerCreateRequest = {},
  ): Promise<MeetingSpeakerResponse> {
    const { data } = await apiClient.post<MeetingSpeakerResponse>(
      "/meeting-speakers",
      payload,
      { params: { meeting_id: meetingId } },
    );
    return data;
  },

  async update(
    meetingId: string,
    speakerId: string,
    payload: MeetingSpeakerUpdateRequest,
  ): Promise<MeetingSpeakerResponse> {
    const { data } = await apiClient.patch<MeetingSpeakerResponse>(
      `/meeting-speakers/${speakerId}`,
      payload,
      { params: { meeting_id: meetingId } },
    );
    return data;
  },

  async delete(meetingId: string, speakerId: string): Promise<void> {
    await apiClient.delete(`/meeting-speakers/${speakerId}`, {
      params: { meeting_id: meetingId },
    });
  },
};
