import { z } from "zod";

import {
  meetingSourceOptions,
  type MeetingSourceId,
} from "@/components/meetings/meeting-source";

const meetingSourceIds = meetingSourceOptions.map((option) => option.id);

/**
 * Mirrors the backend's `MeetingCreate` schema (title: min_length=1,
 * max_length=255; source_type: one of the enum literals) so client-side
 * validation rejects the same inputs the API would 422 on.
 */
export const newMeetingSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Enter a meeting title")
      .max(255, "Title must be 255 characters or fewer"),
    source: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.source || !meetingSourceIds.includes(data.source as MeetingSourceId)) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a meeting source",
        path: ["source"],
      });
    }
  });

export type NewMeetingFormValues = z.infer<typeof newMeetingSchema>;
