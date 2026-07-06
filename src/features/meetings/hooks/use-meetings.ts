"use client";

import { useQuery } from "@tanstack/react-query";

import { meetingsApi } from "@/features/meetings/api";
import { toMeeting } from "@/features/meetings/mappers";

export function useMeetings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meetings"],
    queryFn: meetingsApi.list,
    select: (data) => data.map(toMeeting),
    enabled: options?.enabled ?? true,
  });
}
