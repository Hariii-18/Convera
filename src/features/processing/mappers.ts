import type {
  ProcessingJobResponse,
  ProcessingJobStatus,
} from "@/features/processing/types";

export type ProcessingJob = {
  id: string;
  uploadId: string;
  meetingId: string;
  status: ProcessingJobStatus;
  progress: number;
  stage: string;
  workerName: string | null;
  attempts: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toProcessingJob(response: ProcessingJobResponse): ProcessingJob {
  return {
    id: response.id,
    uploadId: response.upload_id,
    meetingId: response.meeting_id,
    status: response.status,
    progress: response.progress,
    stage: response.stage,
    workerName: response.worker_name,
    attempts: response.attempts,
    startedAt: response.started_at,
    completedAt: response.completed_at,
    errorMessage: response.error_message,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

/** A job is done driving UI state once it reaches a terminal status. */
export function isTerminalStatus(status: ProcessingJobStatus): boolean {
  return status === "completed" || status === "failed";
}

export type ProcessingTransitionToast = {
  variant: "success" | "error" | "message";
  message: string;
};

/**
 * Decides which lifecycle toast (if any) a status change warrants. Returns
 * `null` for no-ops and for a job's first observation (nothing to compare
 * against yet, so no toast fires for state that already existed on mount).
 */
export function getTransitionToast(
  previousStatus: ProcessingJobStatus | undefined,
  currentStatus: ProcessingJobStatus,
): ProcessingTransitionToast | null {
  if (previousStatus === undefined || previousStatus === currentStatus) {
    return null;
  }

  if (currentStatus === "completed") {
    return { variant: "success", message: "Processing completed" };
  }
  if (currentStatus === "failed") {
    return { variant: "error", message: "Processing failed" };
  }
  if (
    previousStatus === "queued" &&
    (currentStatus === "preparing" || currentStatus === "processing")
  ) {
    return { variant: "message", message: "Processing started" };
  }
  return null;
}
