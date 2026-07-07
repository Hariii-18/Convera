"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { processingApi } from "@/features/processing/api";
import {
  getTransitionToast,
  isTerminalStatus,
  toProcessingJob,
  type ProcessingJob,
} from "@/features/processing/mappers";
import type { ProcessingJobStatus } from "@/features/processing/types";

const POLL_INTERVAL_MS = 3000;

function notifyTransitions(
  jobs: ProcessingJob[],
  lastSeen: Map<string, ProcessingJobStatus>,
) {
  for (const job of jobs) {
    const toastInfo = getTransitionToast(lastSeen.get(job.id), job.status);
    lastSeen.set(job.id, job.status);
    if (!toastInfo) continue;

    if (toastInfo.variant === "success") toast.success(toastInfo.message);
    else if (toastInfo.variant === "error") toast.error(toastInfo.message);
    else toast(toastInfo.message);
  }
}

/**
 * Lists processing jobs (optionally scoped to a meeting) and polls every 3s
 * while any job is still in flight. Polling stops once every job has reached
 * a terminal status (completed/failed) and resumes automatically the next
 * time a job is queued or retried, since that flips the list non-terminal
 * again on the next fetch. Also surfaces lifecycle toasts (started/completed/
 * failed) as jobs change status between polls.
 */
export function useProcessing(options?: {
  meetingId?: string;
  enabled?: boolean;
}) {
  const lastSeenRef = useRef<Map<string, ProcessingJobStatus>>(new Map());

  const query = useQuery({
    queryKey: ["processing", options?.meetingId ?? "all"],
    queryFn: () => processingApi.list(options?.meetingId),
    select: (data) => data.map(toProcessingJob),
    enabled: options?.enabled ?? true,
    refetchInterval: (activeQuery) => {
      const jobs = activeQuery.state.data;
      if (!jobs) return POLL_INTERVAL_MS;
      const hasActiveJob = jobs.some((job) => !isTerminalStatus(job.status));
      return hasActiveJob ? POLL_INTERVAL_MS : false;
    },
  });

  useEffect(() => {
    if (query.data) notifyTransitions(query.data, lastSeenRef.current);
  }, [query.data]);

  return query;
}
