"use client";

import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "@/features/dashboard/api";
import { toDashboardStats } from "@/features/dashboard/mappers";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: dashboardApi.stats,
    select: toDashboardStats,
  });
}
