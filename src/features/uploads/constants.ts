/**
 * Mirrors the backend's allow-list (`app/services/upload_validation.py`) so
 * the browser can reject obviously-invalid files before spending a round trip.
 * The backend remains the source of truth and re-validates every upload.
 */
export const ALLOWED_UPLOAD_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "mp4",
  "mov",
  "mkv",
  "webm",
] as const;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/x-aac",
  "audio/aacp",
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
  "audio/webm",
] as const;

/** Matches the backend's `max_upload_size_mb` default (`app/core/config.py`). */
export const MAX_UPLOAD_SIZE_MB = 500;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const ACCEPT_ATTRIBUTE = ALLOWED_UPLOAD_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(",");

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
}

export type UploadValidationError =
  | "unsupported-type"
  | "empty-file"
  | "too-large";

/** Client-side pre-check only — the backend enforces the real limits. */
export function validateUploadFile(file: File): UploadValidationError | null {
  const extension = getExtension(file.name);
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(
    extension as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number],
  )) {
    return "unsupported-type";
  }
  if (file.size === 0) return "empty-file";
  if (file.size > MAX_UPLOAD_SIZE_BYTES) return "too-large";
  return null;
}

export const UPLOAD_VALIDATION_MESSAGES: Record<UploadValidationError, string> = {
  "unsupported-type": `Unsupported file type. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}.`,
  "empty-file": "This file is empty.",
  "too-large": `File exceeds the ${MAX_UPLOAD_SIZE_MB}MB limit.`,
};
