import {
  AudioLines,
  Captions,
  CircleCheck,
  CircleX,
  Clock,
  PackageCheck,
  Settings2,
  Sparkles,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";

import type { ProcessingStage } from "@/components/processing/types";

export const processingStageConfig: Record<
  ProcessingStage,
  { label: string; icon: LucideIcon }
> = {
  queued: { label: "Queued", icon: Clock },
  uploading: { label: "Uploading", icon: UploadCloud },
  preparing: { label: "Preparing", icon: Settings2 },
  chunking: { label: "Chunking audio", icon: AudioLines },
  transcribing: { label: "Transcribing", icon: Captions },
  summarizing: { label: "Summarizing", icon: Sparkles },
  finalizing: { label: "Finalizing", icon: PackageCheck },
  completed: { label: "Completed", icon: CircleCheck },
  failed: { label: "Failed", icon: CircleX },
};

/** Coarse status derived from `stage`, for the status badge. */
export function getProcessingStatus(stage: ProcessingStage) {
  if (stage === "completed") return "completed" as const;
  if (stage === "failed") return "failed" as const;
  if (stage === "queued") return "queued" as const;
  return "processing" as const;
}
