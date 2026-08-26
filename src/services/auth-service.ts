import { apiClient } from "@/lib/api-client";
import type { AuthResponse, User } from "@/features/auth/types";

export type RegisterPayload = {
  email: string;
  full_name: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type UpdateProfilePayload = {
  full_name?: string;
  timezone?: string;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
};

export const authService = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(
      "/auth/register",
      payload,
    );
    return data;
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(
      "/auth/login",
      payload,
    );
    return data;
  },

  async getCurrentUser(): Promise<User> {
    const { data } = await apiClient.get<User>("/auth/me");
    return data;
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<User> {
    const { data } = await apiClient.patch<User>("/auth/me", payload);
    return data;
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await apiClient.post("/auth/me/password", payload);
  },
};
