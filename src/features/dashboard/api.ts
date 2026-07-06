import { apiClient } from "@/lib/api-client";
import type { DashboardStatsResponse } from "@/features/dashboard/types";

export const dashboardApi = {
  async stats(): Promise<DashboardStatsResponse> {
    const { data } =
      await apiClient.get<DashboardStatsResponse>("/dashboard/stats");
    return data;
  },
};
