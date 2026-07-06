export type DashboardStatsResponse = {
  total_meetings: number;
  completed_meetings: number;
  processing_meetings: number;
  failed_meetings: number;
  storage_used_bytes: number;
};
