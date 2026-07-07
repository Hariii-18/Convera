export type DashboardStatsResponse = {
  total_meetings: number;
  storage_used_bytes: number;
  currently_processing: number;
  queued_jobs: number;
  completed_today: number;
  failed_jobs: number;
};
