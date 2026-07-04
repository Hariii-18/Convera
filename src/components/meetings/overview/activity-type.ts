import {
  CalendarPlus,
  CircleCheck,
  Pencil,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import type {
  ActivityEventType,
  ActivityTypeConfigEntry,
} from "@/components/meetings/overview/types";

export const activityTypeConfig: Record<
  ActivityEventType,
  ActivityTypeConfigEntry
> = {
  "processing-completed": { label: "Processing completed", icon: CircleCheck },
  "transcript-edited": { label: "Transcript edited", icon: Pencil },
  "summary-generated": { label: "Summary generated", icon: Sparkles },
  "recording-uploaded": { label: "Recording uploaded", icon: UploadCloud },
  "meeting-created": { label: "Meeting created", icon: CalendarPlus },
};
