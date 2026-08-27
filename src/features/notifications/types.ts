/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * notifications feature.
 */

export type NotificationType =
  | "processing_completed"
  | "processing_failed"
  | "processing_cancelled";

export type NotificationResponse = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  meeting_id: string | null;
  processing_job_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type UnreadCountResponse = {
  count: number;
};
