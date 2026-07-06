import { apiClient } from "@/lib/api-client";
import type {
  MeetingCreatePayload,
  MeetingResponse,
  MeetingUpdatePayload,
} from "@/features/meetings/types";

export const meetingsApi = {
  async list(): Promise<MeetingResponse[]> {
    const { data } = await apiClient.get<MeetingResponse[]>("/meetings");
    return data;
  },

  async get(id: string): Promise<MeetingResponse> {
    const { data } = await apiClient.get<MeetingResponse>(`/meetings/${id}`);
    return data;
  },

  async create(payload: MeetingCreatePayload): Promise<MeetingResponse> {
    const { data } = await apiClient.post<MeetingResponse>(
      "/meetings",
      payload,
    );
    return data;
  },

  async update(
    id: string,
    payload: MeetingUpdatePayload,
  ): Promise<MeetingResponse> {
    const { data } = await apiClient.patch<MeetingResponse>(
      `/meetings/${id}`,
      payload,
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/meetings/${id}`);
  },
};
