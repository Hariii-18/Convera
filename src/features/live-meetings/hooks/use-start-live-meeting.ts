"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { liveMeetingsApi } from "@/features/live-meetings/api";
import { toLiveMeetingSession } from "@/features/live-meetings/mappers";

/**
 * Starts (or resumes) the caller's Live Meeting session. `title` is
 * required — the backend rejects an empty/whitespace-only title — and is
 * trimmed here too so a purely-whitespace value never reaches the API.
 *
 * The backend is idempotent against duplicate starts: a second call while a
 * session is already active/stopping/finalizing returns that same session
 * (and ignores the given title) rather than creating a new one, so this
 * hook does not need its own guard beyond the capture panel disabling the
 * Start action while a session is in flight.
 */
export function useStartLiveMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      const response = await liveMeetingsApi.start({ title: title.trim() });
      return toLiveMeetingSession(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}
