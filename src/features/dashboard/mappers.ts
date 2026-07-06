import type { DashboardStatsResponse } from "@/features/dashboard/types";

export type DashboardStats = {
  totalMeetings: number;
  completedMeetings: number;
  processingMeetings: number;
  failedMeetings: number;
  storageUsedBytes: number;
};

export function toDashboardStats(
  response: DashboardStatsResponse,
): DashboardStats {
  return {
    totalMeetings: response.total_meetings,
    completedMeetings: response.completed_meetings,
    processingMeetings: response.processing_meetings,
    failedMeetings: response.failed_meetings,
    storageUsedBytes: response.storage_used_bytes,
  };
}
