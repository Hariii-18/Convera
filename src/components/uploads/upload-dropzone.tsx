"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_UPLOAD_EXTENSIONS,
  MAX_UPLOAD_SIZE_MB,
} from "@/features/uploads/constants";

type UploadDropzoneProps = {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
};

type UploadDropzoneHandle = {
  open: () => void;
};

const SUPPORTED_TYPES_LABEL = ALLOWED_UPLOAD_EXTENSIONS.join(", ").toUpperCase();

/**
 * Drag-and-drop + click-to-browse entry point for the Upload Center. Emits
 * whatever file the user picks or drops — validation and the actual upload
 * are the caller's responsibility (see `useUpload`). Exposes `open()` via
 * ref so a page-level "Upload" button can trigger the same file picker.
 */
const UploadDropzone = React.forwardRef<UploadDropzoneHandle, UploadDropzoneProps>(
  function UploadDropzone({ onFileSelected, disabled = false }, ref) {
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function openBrowse() {
    if (!disabled) inputRef.current?.click();
  }

  React.useImperativeHandle(ref, () => ({ open: openBrowse }));

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div
      data-slot="upload-dropzone"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled ? true : undefined}
      aria-label="Upload a recording. Drag and drop a file here, or activate to browse your files."
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-12 text-center transition-colors outline-none",
        !disabled && "cursor-pointer hover:border-primary/50 hover:bg-muted/50",
        isDraggingOver && !disabled && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-50",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
      onClick={openBrowse}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openBrowse();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UploadCloud className="size-6" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          Drag &amp; drop a recording here
        </p>
        <p className="text-sm text-muted-foreground">
          or click to browse your files
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          openBrowse();
        }}
      >
        Browse files
      </Button>

      <p className="text-xs text-muted-foreground">
        Supports {SUPPORTED_TYPES_LABEL} &middot; Up to {MAX_UPLOAD_SIZE_MB}MB
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file);
          event.target.value = "";
        }}
      />
    </div>
  );
  },
);

export { UploadDropzone };
export type { UploadDropzoneProps, UploadDropzoneHandle };
