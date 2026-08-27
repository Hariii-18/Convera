"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  authService,
  type UpdateProfilePayload,
} from "@/services/auth-service";
import { useAuthStore } from "@/store/auth-store";

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) =>
      authService.updateProfile(payload),
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(["auth", "me"], user);
    },
  });
}
