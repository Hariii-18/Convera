"use client";

import * as React from "react";
import axios from "axios";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ActiveUploadCard } from "@/components/uploads/active-upload-card";
import { UploadDropzone } from "@/components/uploads/upload-dropzone";
import { extractErrorMessage } from "@/features/auth/error";
import { UploadValidationError, useUpload } from "@/features/uploads/hooks/use-upload";
import type { Upload } from "@/features/uploads/mappers";

function getUploadErrorMessage(error: unknown): string {
  if (error instanceof UploadValidationError) return error.message;
  return extractErrorMessage(error);
}

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  meetingTitle?: string;
  onUploaded?: (upload: Upload) => void;
};

/**
 * Meeting-scoped upload flow: drop/pick a file, upload it, and attach it to
 * `meetingId`. The Upload Engine (`useUpload`) always receives a meeting id
 * here, so every upload created through this dialog is linked from the start.
 *
 * Has no reset-on-close effect — callers must unmount this on close (e.g.
 * `{target && <UploadDialog ... />}`) rather than keeping it mounted with
 * `open=false`, or file/mutation state will leak into the next open.
 */
function UploadDialog({
  open,
  onOpenChange,
  meetingId,
  meetingTitle,
  onUploaded,
}: UploadDialogProps) {
  const [currentFile, setCurrentFile] = React.useState<File | null>(null);
  const uploadMutation = useUpload();

  function handleFileSelected(file: File) {
    setCurrentFile(file);
    uploadMutation.mutate(
      { file, meetingId },
      {
        onSuccess: (upload) => {
          toast.success(`"${file.name}" uploaded successfully`);
          toast("Queued for processing");
          onUploaded?.(upload);
        },
        onError: (mutationError) => {
          if (axios.isCancel(mutationError)) return;
          toast.error(getUploadErrorMessage(mutationError));
        },
      },
    );
  }

  function handleCancel() {
    uploadMutation.cancel();
    setCurrentFile(null);
    uploadMutation.reset();
  }

  function handleRemove() {
    setCurrentFile(null);
    uploadMutation.reset();
  }

  const activeStatus = !currentFile
    ? null
    : uploadMutation.isError
      ? "error"
      : uploadMutation.isSuccess
        ? "success"
        : "uploading";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="upload-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload recording</DialogTitle>
          <DialogDescription>
            {meetingTitle
              ? `Add a recording to "${meetingTitle}".`
              : "Add a recording to this meeting."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <UploadDropzone
            onFileSelected={handleFileSelected}
            disabled={uploadMutation.isPending}
          />

          {currentFile && activeStatus && (
            <ActiveUploadCard
              file={currentFile}
              status={activeStatus}
              progress={uploadMutation.progress}
              errorMessage={
                activeStatus === "error"
                  ? getUploadErrorMessage(uploadMutation.error)
                  : undefined
              }
              onCancel={activeStatus === "uploading" ? handleCancel : undefined}
              onRetry={
                activeStatus === "error"
                  ? () => handleFileSelected(currentFile)
                  : undefined
              }
              onRemove={activeStatus !== "uploading" ? handleRemove : undefined}
            />
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {activeStatus === "success" ? "Done" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { UploadDialog };
export type { UploadDialogProps };
