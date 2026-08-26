import type {
  NotificationResponse,
  NotificationType,
} from "@/features/notifications/types";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  meetingId: string | null;
  processingJobId: string | null;
  isRead: boolean;
  createdAt: string;
};

export function toNotification(response: NotificationResponse): Notification {
  return {
    id: response.id,
    type: response.type,
    title: response.title,
    message: response.message,
    meetingId: response.meeting_id,
    processingJobId: response.processing_job_id,
    isRead: response.is_read,
    createdAt: response.created_at,
  };
}
