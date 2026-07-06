import { create } from "zustand";

import type { Meeting } from "@/components/meetings/types";

interface GuestMeetingsState {
  meetings: Meeting[];
  addMeeting: (meeting: Meeting) => void;
  getMeeting: (id: string) => Meeting | undefined;
}

/**
 * Meetings created while browsing as a guest. Deliberately not persisted
 * (no `persist` middleware) — this is in-memory only, so a page refresh
 * clears it, matching Guest Mode's "nothing is saved" contract.
 */
export const useGuestMeetingsStore = create<GuestMeetingsState>(
  (set, get) => ({
    meetings: [],
    addMeeting: (meeting) =>
      set((state) => ({ meetings: [meeting, ...state.meetings] })),
    getMeeting: (id) => get().meetings.find((meeting) => meeting.id === id),
  }),
);
