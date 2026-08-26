"use client";

import { useAuthStore } from "@/store/auth-store";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** The signed-in user's timezone preference, for rendering meeting/date
 * timestamps in local time. Stored timestamps stay UTC either way. */
export function useUserTimezone(): string {
  return useAuthStore((state) => state.user?.timezone) ?? DEFAULT_TIMEZONE;
}
