/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * uploads feature. See `@/features/uploads/mappers` for the UI-shaped
 * `Upload` type these get mapped into.
 */

export type UploadStatus = "uploading" | "uploaded" | "failed" | "deleted";

export type UploadResponse = {
  id: string;
  meeting_id: string | null;
  original_filename: string;
  stored_filename: string;
  storage_path: string;
  bucket: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  status: UploadStatus;
  created_at: string;
  updated_at: string;
};
