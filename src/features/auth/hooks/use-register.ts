"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { setAccessTokenCookie } from "@/lib/cookies";
import { authService, type RegisterPayload } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth-store";

export function useRegister() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: (data) => {
      setAccessTokenCookie(data.access_token, data.expires_in);
      setUser(data.user);
      router.push("/dashboard");
      router.refresh();
    },
  });
}
