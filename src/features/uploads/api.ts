import type { AxiosProgressEvent } from "axios";

import { apiClient } from "@/lib/api-client";
import type { UploadResponse } from "@/features/uploads/types";

type UploadFileOptions = {
  meetingId?: string;
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

  async upload(
    file: File,
    options?: UploadFileOptions,
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (options?.meetingId) {
      formData.append("meeting_id", options.meetingId);
    }

    const { data } = await apiClient.post<UploadResponse>(
      "/uploads",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        signal: options?.signal,
        onUploadProgress: options?.onUploadProgress,
      },
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/uploads/${id}`);
  },
};
