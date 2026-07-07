"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { processingApi } from "@/features/processing/api";
import {
  getTransitionToast,
  isTerminalStatus,
  toProcessingJob,
} from "@/features/processing/mappers";
import type { ProcessingJobStatus } from "@/features/processing/types";

const POLL_INTERVAL_MS = 3000;

/**
 * Tracks the most recent processing job for a single meeting (the Meeting
 * Workspace's view of "what's happening to my recording right now"). Polls
 * every 3s until that job reaches a terminal status, and surfaces lifecycle
 * toasts (started/completed/failed) as it changes status between polls.
 */
export function useProcessingJob(
  meetingId: string,
  options?: { enabled?: boolean },
) {
  const lastStatusRef = useRef<ProcessingJobStatus | undefined>(undefined);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["processing", "meeting", meetingId],
    queryFn: () => processingApi.list(meetingId),
    select: (data) => {
      const [latest] = data;
      return latest ? toProcessingJob(latest) : null;
    },
    enabled: Boolean(meetingId) && (options?.enabled ?? true),
    refetchInterval: (activeQuery) => {
      const [latest] = activeQuery.state.data ?? [];
      if (!latest) return false;
      return isTerminalStatus(latest.status) ? false : POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    const job = query.data;
    if (!job) return;

    const toastInfo = getTransitionToast(lastStatusRef.current, job.status);
    lastStatusRef.current = job.status;
    if (!toastInfo) return;

    if (toastInfo.variant === "success") toast.success(toastInfo.message);
    else if (toastInfo.variant === "error") toast.error(toastInfo.message);
    else toast(toastInfo.message);

    if (isTerminalStatus(job.status)) {
      // The meeting's own status (shown in the workspace header/badge) tracks
      // this job's terminal state server-side — refresh it so the badge
      // doesn't sit on a stale "Processing" after this job finishes.
      queryClient.invalidateQueries({ queryKey: ["meetings", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    }
  }, [query.data, queryClient, meetingId]);

  return query;
}
