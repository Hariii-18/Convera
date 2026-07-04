/**
 * Domain types for the meetings feature. Shared by MeetingsTable and any
 * future consumer (Dashboard, Meetings page) so they stay in sync.
 */

export type MeetingStatus = "scheduled" | "processing" | "completed" | "failed";

export type Meeting = {
  id: string;
  title: string;
  status: MeetingStatus;
  /** Total length in seconds. Omit or null while duration is unknown (e.g. still processing). */
  durationSeconds?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  /** Optional participant count, shown as a secondary line under the title. */
  participantCount?: number;
};
