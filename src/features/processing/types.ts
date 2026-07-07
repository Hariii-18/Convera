/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * processing feature. See `@/features/processing/mappers` for the UI-shaped
 * `ProcessingJob` type these get mapped into.
 */

export type ProcessingJobStatus =
  | "queued"
  | "preparing"
  | "processing"
  | "completed"
  | "failed";

export type ProcessingJobResponse = {
  id: string;
  upload_id: string;
  meeting_id: string;
  user_id: number;
  status: ProcessingJobStatus;
  progress: number;
  stage: string;
  worker_name: string | null;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateProcessingJobPayload = {
  upload_id: string;
};
