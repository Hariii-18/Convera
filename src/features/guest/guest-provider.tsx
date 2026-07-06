"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useAuthStore } from "@/store/auth-store";

type GuestSessionValue = {
  /** True once we can confidently say there's no signed-in user. */
  isGuest: boolean;
  /** True once the auth store has finished reading from localStorage. */
  isReady: boolean;
};

const GuestSessionContext = createContext<GuestSessionValue | null>(null);

/**
 * Guest Mode isn't a separate opt-in — it's the state any visitor without a
 * signed-in user is automatically in. This just derives that from the
 * existing auth store and exposes it so pages don't each re-derive it.
 */
export function GuestProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  const value = useMemo<GuestSessionValue>(
    () => ({ isGuest: isHydrated && !user, isReady: isHydrated }),
    [user, isHydrated],
  );

  return (
    <GuestSessionContext.Provider value={value}>
      {children}
    </GuestSessionContext.Provider>
  );
}

export function useGuestSession(): GuestSessionValue {
  const context = useContext(GuestSessionContext);
  if (!context) {
    throw new Error("useGuestSession must be used within a GuestProvider");
  }
  return context;
}
