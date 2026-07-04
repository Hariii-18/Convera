import type { Meeting } from "@/components/meetings/types";

/**
 * Fixture data for the meetings index. Stands in for a real meetings list
 * until the app has an API to fetch one.
 */
export const mockMeetings: Meeting[] = [
  {
    id: "meeting-1",
    title: "Q3 roadmap sync",
    status: "completed",
    durationSeconds: 2745,
    createdAt: "2026-07-03T15:00:00Z",
    updatedAt: "2026-07-03T16:10:00Z",
    participantCount: 5,
  },
  {
    id: "meeting-2",
    title: "Design review: pricing page",
    status: "processing",
    durationSeconds: 1860,
    createdAt: "2026-07-03T10:30:00Z",
    updatedAt: "2026-07-03T11:05:00Z",
    participantCount: 4,
  },
  {
    id: "meeting-3",
    title: "1:1 with Priya",
    status: "completed",
    durationSeconds: 1500,
    createdAt: "2026-07-02T18:00:00Z",
    updatedAt: "2026-07-02T18:26:00Z",
    participantCount: 2,
  },
  {
    id: "meeting-4",
    title: "Payments migration spike debrief",
    status: "failed",
    durationSeconds: 620,
    createdAt: "2026-07-01T13:00:00Z",
    updatedAt: "2026-07-01T13:11:00Z",
    participantCount: 3,
  },
  {
    id: "meeting-5",
    title: "All-hands: July kickoff",
    status: "completed",
    durationSeconds: 3320,
    createdAt: "2026-06-30T16:00:00Z",
    updatedAt: "2026-06-30T17:00:00Z",
    participantCount: 24,
  },
  {
    id: "meeting-6",
    title: "Customer discovery call — Acme Corp",
    status: "scheduled",
    durationSeconds: null,
    createdAt: "2026-06-29T09:00:00Z",
    updatedAt: "2026-06-29T09:00:00Z",
    participantCount: 3,
  },
  {
    id: "meeting-7",
    title: "Engineering sync",
    status: "completed",
    durationSeconds: 1980,
    createdAt: "2026-06-27T14:00:00Z",
    updatedAt: "2026-06-27T14:33:00Z",
    participantCount: 6,
  },
  {
    id: "meeting-8",
    title: "Board update prep",
    status: "completed",
    durationSeconds: 2100,
    createdAt: "2026-06-25T12:00:00Z",
    updatedAt: "2026-06-25T12:35:00Z",
    participantCount: 4,
  },
];
