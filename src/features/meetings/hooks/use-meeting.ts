"use client";

import { useQuery } from "@tanstack/react-query";

import { meetingsApi } from "@/features/meetings/api";
import { toMeeting } from "@/features/meetings/mappers";

export function useMeeting(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meetings", id],
    queryFn: () => meetingsApi.get(id),
    select: toMeeting,
    enabled: Boolean(id) && (options?.enabled ?? true),
    retry: false,
  });
}
