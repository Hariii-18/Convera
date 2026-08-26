import type {
  UploadPlaybackResponse,
  UploadResponse,
  UploadStatus,
} from "@/features/uploads/types";

export type Upload = {
  id: string;
  meetingId: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  status: UploadStatus;
  createdAt: string;
  updatedAt: string;
};

export function toUpload(response: UploadResponse): Upload {
  return {
    id: response.id,
    meetingId: response.meeting_id,
    originalFilename: response.original_filename,
    mimeType: response.mime_type,
    sizeBytes: response.size_bytes,
    durationSeconds: response.duration_seconds,
    status: response.status,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

export type UploadPlayback = {
  url: string;
  mimeType: string;
  expiresIn: number;
};

export function toUploadPlayback(response: UploadPlaybackResponse): UploadPlayback {
  return {
    url: response.url,
    mimeType: response.mime_type,
    expiresIn: response.expires_in,
  };
}
