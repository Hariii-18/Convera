"use client";

import { useEffect } from "react";
import axios from "axios";

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
  const { data, error } = useCurrentUserQuery(hasToken);

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  useEffect(() => {
    // Only a confirmed 401 (invalid/expired token) should sign the user out.
    // Any other failure (network blip, transient 5xx) leaves the existing
    // session in place rather than logging the user out from underneath them.
    const isUnauthorized =
      axios.isAxiosError(error) && error.response?.status === 401;
    if (isUnauthorized) {
      clearAccessTokenCookie();
      clearUser();
    }
  }, [error, clearUser]);

  return null;
}
