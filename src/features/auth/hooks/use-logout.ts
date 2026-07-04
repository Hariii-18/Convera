"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { clearAccessTokenCookie } from "@/lib/cookies";
import { useAuthStore } from "@/store/auth-store";

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearUser = useAuthStore((state) => state.clearUser);

  return useCallback(() => {
    clearAccessTokenCookie();
    clearUser();
    queryClient.clear();
    router.push("/login");
    router.refresh();
  }, [clearUser, queryClient, router]);
}
