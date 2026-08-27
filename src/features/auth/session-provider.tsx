"use client";

import { useEffect } from "react";

import { useCurrentUserQuery } from "@/features/auth/hooks/use-current-user";
import { getAccessTokenCookie } from "@/lib/cookies";
import { useAuthStore } from "@/store/auth-store";

/**
 * Revalidates the session against `/auth/me` on load. The auth-token cookie
 * says a session might be valid; this confirms it and refreshes the cached
 * user. Renders nothing — it only synchronizes the auth store.
 *
 * A confirmed-invalid token (a genuine 401 from `/auth/me`) is handled in
 * one place, `apiClient`'s response interceptor, rather than here too —
 * that avoids two independent code paths racing to clear the same session.
 */
export function SessionProvider() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const setUser = useAuthStore((state) => state.setUser);

  const hasToken = isHydrated && Boolean(getAccessTokenCookie());
  const { data } = useCurrentUserQuery(hasToken);

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  return null;
}
