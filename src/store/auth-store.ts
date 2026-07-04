import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { User } from "@/features/auth/types";

interface AuthState {
  user: User | null;
  /** True once the persisted store has finished reading from localStorage. */
  isHydrated: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
  setHydrated: () => void;
}

/**
 * Holds the current user for display (name/email in the UI) and survives
 * page refreshes via localStorage. It is a cache, not the source of truth
 * for whether the session is valid — the access-token cookie plus a `/me`
 * revalidation (see `SessionProvider`) own that.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isHydrated: false,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: "converra-auth-user",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
