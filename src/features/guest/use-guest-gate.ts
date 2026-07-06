"use client";

import { useCallback, useState } from "react";

import { useGuestSession } from "@/features/guest/guest-provider";
import type { GuestRestrictedAction } from "@/features/guest/permissions";

/**
 * Single reusable primitive for gating an action behind a real account.
 * Real users run the callback immediately; guests get the upgrade dialog
 * instead of the action ever running.
 */
export function useGuestGate() {
  const { isGuest } = useGuestSession();
  const [pendingAction, setPendingAction] =
    useState<GuestRestrictedAction | null>(null);

  const guard = useCallback(
    (action: GuestRestrictedAction, run: () => void) => {
      if (isGuest) {
        setPendingAction(action);
        return;
      }
      run();
    },
    [isGuest],
  );

  const closeDialog = useCallback(() => setPendingAction(null), []);

  return { isGuest, pendingAction, guard, closeDialog };
}
