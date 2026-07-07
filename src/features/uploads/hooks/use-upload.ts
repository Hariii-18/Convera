"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadsApi } from "@/features/uploads/api";
import { toUpload } from "@/features/uploads/mappers";
import {
  UPLOAD_VALIDATION_MESSAGES,
  validateUploadFile,
} from "@/features/uploads/constants";

export class UploadValidationError extends Error {}

type UploadInput = { file: File; meetingId?: string };

/**
 * Drives a single in-flight upload: client-side pre-validation, the actual
 * multipart POST, live progress, and cancellation. Cache invalidation on
 * success covers uploads, dashboard stats, and meetings, per the Upload
 * Engine's integration contract.
 */
export function useUpload() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ file, meetingId }: UploadInput) => {
      const validationError = validateUploadFile(file);
      if (validationError) {
        throw new UploadValidationError(
          UPLOAD_VALIDATION_MESSAGES[validationError],
        );
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      setProgress(0);

      const response = await uploadsApi.upload(file, {
        meetingId,
        signal: controller.signal,
        onUploadProgress: (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      });
      return toUpload(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
    onSettled: () => {
      controllerRef.current = null;
    },
  });

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { ...mutation, progress, cancel };
}
