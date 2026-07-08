"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { authService } from "@/services/auth-service";

export function useCurrentUserQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: authService.getCurrentUser,
    enabled,
    // A 401 means the token is genuinely invalid/expired — retrying won't
    // help, so fail fast. Anything else (network blip, transient 5xx) is
    // worth a couple of retries so a flaky request doesn't look like an
    // expired session.
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
