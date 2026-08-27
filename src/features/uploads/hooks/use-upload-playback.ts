"use client";

import { useQuery } from "@tanstack/react-query";

import { uploadsApi } from "@/features/uploads/api";
import { toUploadPlayback } from "@/features/uploads/mappers";

/**
 * Signed playback URL for a recording. Refetched well before the URL's own
 * expiry (`PLAYBACK_URL_EXPIRES_IN` on the backend, currently 1 hour) so a
 * long-open workspace tab never hands the player a dead link.
 */
export function useUploadPlayback(
  uploadId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["uploads", uploadId, "playback"],
    queryFn: () => uploadsApi.getPlaybackUrl(uploadId!),
    select: toUploadPlayback,
    enabled: Boolean(uploadId) && (options?.enabled ?? true),
    staleTime: 45 * 60 * 1000,
    retry: 1,
  });
}
