"use client";

import { useEffect } from "react";

import { useCurrentUserQuery } from "@/features/auth/hooks/use-current-user";
import { clearAccessTokenCookie, getAccessTokenCookie } from "@/lib/cookies";
import { useAuthStore } from "@/store/auth-store";

/**
 * Revalidates the session against `/auth/me` on load. The auth-token cookie
 * says a session might be valid; this confirms it and refreshes the cached
 * user, or clears everything if the token has expired server-side.
 * Renders nothing — it only synchronizes the auth store.
 */
export function SessionProvider() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);

  const hasToken = isHydrated && Boolean(getAccessTokenCookie());
  const { data, isError } = useCurrentUserQuery(hasToken);

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  useEffect(() => {
    if (isError) {
      clearAccessTokenCookie();
      clearUser();
    }
  }, [isError, clearUser]);

  return null;
}
