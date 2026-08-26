"use client";

import { useQuery } from "@tanstack/react-query";

import { notificationsApi } from "@/features/notifications/api";
import { toNotification } from "@/features/notifications/mappers";

const POLL_INTERVAL_MS = 30_000;

/**
 * Lists the signed-in user's most recent notifications (read and unread),
 * polling in the background so the bell badge stays current without a
 * manual refresh. Not enabled until the caller says so (e.g. once the
 * session is confirmed) to avoid firing before auth is ready.
 */
export function useNotifications(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    select: (data) => data.map(toNotification),
    enabled: options?.enabled ?? true,
    refetchInterval: POLL_INTERVAL_MS,
  });
}
