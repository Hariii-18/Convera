import { apiClient } from "@/lib/api-client";
import type {
  NotificationResponse,
  UnreadCountResponse,
} from "@/features/notifications/types";

export const notificationsApi = {
  async list(unreadOnly?: boolean): Promise<NotificationResponse[]> {
    const { data } = await apiClient.get<NotificationResponse[]>(
      "/notifications",
      { params: unreadOnly ? { unread_only: true } : undefined },
    );
    return data;
  },

  async unreadCount(): Promise<UnreadCountResponse> {
    const { data } = await apiClient.get<UnreadCountResponse>(
      "/notifications/unread-count",
    );
    return data;
  },

  async markRead(id: string): Promise<NotificationResponse> {
    const { data } = await apiClient.patch<NotificationResponse>(
      `/notifications/${id}/read`,
    );
    return data;
  },

  async markAllRead(): Promise<void> {
    await apiClient.post("/notifications/read-all");
  },
};
