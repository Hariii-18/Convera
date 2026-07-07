import type { DashboardStatsResponse } from "@/features/dashboard/types";

export type DashboardStats = {
  totalMeetings: number;
  storageUsedBytes: number;
  currentlyProcessing: number;
  queuedJobs: number;
  completedToday: number;
  failedJobs: number;
};

export function toDashboardStats(
  response: DashboardStatsResponse,
): DashboardStats {
  return {
    totalMeetings: response.total_meetings,
    storageUsedBytes: response.storage_used_bytes,
    currentlyProcessing: response.currently_processing,
    queuedJobs: response.queued_jobs,
    completedToday: response.completed_today,
    failedJobs: response.failed_jobs,
  };
}
