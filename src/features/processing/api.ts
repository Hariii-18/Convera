import { apiClient } from "@/lib/api-client";
import type {
  CreateProcessingJobPayload,
  ProcessingJobResponse,
} from "@/features/processing/types";

export const processingApi = {
  async list(meetingId?: string): Promise<ProcessingJobResponse[]> {
    const { data } = await apiClient.get<ProcessingJobResponse[]>("/process", {
      params: meetingId ? { meeting_id: meetingId } : undefined,
    });
    return data;
  },

  async get(id: string): Promise<ProcessingJobResponse> {
    const { data } = await apiClient.get<ProcessingJobResponse>(
      `/process/${id}`,
    );
    return data;
  },

  async create(
    payload: CreateProcessingJobPayload,
  ): Promise<ProcessingJobResponse> {
    const { data } = await apiClient.post<ProcessingJobResponse>(
      "/process",
      payload,
    );
    return data;
  },

  async retry(id: string): Promise<ProcessingJobResponse> {
    const { data } = await apiClient.post<ProcessingJobResponse>(
      `/process/${id}/retry`,
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/process/${id}`);
  },
};
