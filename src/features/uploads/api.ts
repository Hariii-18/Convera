import type { AxiosProgressEvent } from "axios";

import { apiClient } from "@/lib/api-client";
import type {
  UploadPlaybackResponse,
  UploadResponse,
} from "@/features/uploads/types";

type UploadFileOptions = {
  meetingId: string;
  signal?: AbortSignal;
  onUploadProgress?: (event: AxiosProgressEvent) => void;
};

export const uploadsApi = {
  async list(): Promise<UploadResponse[]> {
    const { data } = await apiClient.get<UploadResponse[]>("/uploads");
    return data;
  },

  async get(id: string): Promise<UploadResponse> {
    const { data } = await apiClient.get<UploadResponse>(`/uploads/${id}`);
    return data;
  },

  async getPlaybackUrl(id: string): Promise<UploadPlaybackResponse> {
    const { data } = await apiClient.get<UploadPlaybackResponse>(
      `/uploads/${id}/playback`,
    );
    return data;
  },

  async upload(
    file: File,
    options: UploadFileOptions,
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("meeting_id", options.meetingId);

    const { data } = await apiClient.post<UploadResponse>(
      "/uploads",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        signal: options?.signal,
        onUploadProgress: options?.onUploadProgress,
        timeout: 0, // large files can take longer than the default request timeout
      },
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/uploads/${id}`);
  },
};
