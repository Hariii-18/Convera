"use client";

import { useQuery } from "@tanstack/react-query";

import { uploadsApi } from "@/features/uploads/api";
import { toUpload } from "@/features/uploads/mappers";

export function useUploads(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["uploads"],
    queryFn: uploadsApi.list,
    select: (data) => data.map(toUpload),
    enabled: options?.enabled ?? true,
  });
}
