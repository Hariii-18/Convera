import {
  CalendarPlus,
  CircleCheck,
  CircleX,
  Clock,
  Pencil,
  Play,
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
  "processing-started": { label: "Processing started", icon: Play },
  "processing-failed": { label: "Processing failed", icon: CircleX },
  queued: { label: "Queued for processing", icon: Clock },
  "transcript-edited": { label: "Transcript edited", icon: Pencil },
  "summary-generated": { label: "Summary generated", icon: Sparkles },
  "recording-uploaded": { label: "Recording uploaded", icon: UploadCloud },
  "meeting-created": { label: "Meeting created", icon: CalendarPlus },
};
