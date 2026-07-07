"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { AlertTriangle, History, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ActiveUploadCard,
  type ActiveUploadStatus,
} from "@/components/uploads/active-upload-card";
import { DeleteUploadDialog } from "@/components/uploads/delete-upload-dialog";
import { RecentUploadsList } from "@/components/uploads/recent-uploads-list";
import {
  UploadDropzone,
  type UploadDropzoneHandle,
} from "@/components/uploads/upload-dropzone";
import { extractErrorMessage } from "@/features/auth/error";
import { useGuestSession } from "@/features/guest/guest-provider";
import { useDeleteUpload } from "@/features/uploads/hooks/use-delete-upload";
import { UploadValidationError, useUpload } from "@/features/uploads/hooks/use-upload";
import { useUploads } from "@/features/uploads/hooks/use-uploads";
import type { Upload } from "@/features/uploads/mappers";

function getUploadErrorMessage(error: unknown): string {
  if (error instanceof UploadValidationError) return error.message;
  return extractErrorMessage(error);
}

export default function UploadsPage() {
  const router = useRouter();
  const { isGuest, isReady } = useGuestSession();

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Upload | null>(null);
  const dropzoneRef = useRef<UploadDropzoneHandle>(null);

  const {
    data: uploads,
    isLoading,
    isError,
    error,
    refetch,
  } = useUploads({ enabled: isReady && !isGuest });
  const uploadMutation = useUpload();
  const deleteMutation = useDeleteUpload();

  function handleFileSelected(file: File) {
    setCurrentFile(file);
    uploadMutation.mutate(
      { file },
      {
        onSuccess: (upload) => {
          toast.success(`"${file.name}" uploaded successfully`);
          if (upload.meetingId) {
            toast("Queued for processing");
            router.push(`/meetings/${upload.meetingId}`);
          }
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

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Upload deleted");
        setDeleteTarget(null);
      },
      onError: (mutationError) => {
        toast.error(extractErrorMessage(mutationError));
      },
    });
  }

  if (isGuest) {
    return (
      <PageContainer className="flex flex-col gap-6">
        <SectionHeader
          as="h1"
          title="Uploads"
          description="Upload an existing recording to have it processed."
        />
        <EmptyState
          icon={<History />}
          title="Uploads need an account"
          description="Create a free account to upload and store your recordings in the cloud."
          action={
            <Button size="sm" onClick={() => router.push("/register")}>
              Create free account
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const activeStatus: ActiveUploadStatus | null = !currentFile
    ? null
    : uploadMutation.isError
      ? "error"
      : uploadMutation.isSuccess
        ? "success"
        : "uploading";

  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Uploads"
        description="Upload an existing recording to have it processed."
        action={
          <Button size="sm" onClick={() => dropzoneRef.current?.open()}>
            <UploadCloud data-icon="inline-start" />
            Upload recording
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <UploadDropzone
            ref={dropzoneRef}
            onFileSelected={handleFileSelected}
            disabled={uploadMutation.isPending}
          />

          <div aria-live="polite" className="sr-only">
            {activeStatus === "uploading" &&
              `Uploading ${currentFile?.name}, ${uploadMutation.progress} percent`}
            {activeStatus === "success" && `${currentFile?.name} uploaded successfully`}
            {activeStatus === "error" &&
              `Upload failed: ${getUploadErrorMessage(uploadMutation.error)}`}
          </div>

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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle as="h2">Recent uploads</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {isError ? (
            <EmptyState
              icon={<AlertTriangle />}
              title="Couldn't load uploads"
              description={extractErrorMessage(error)}
              action={
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              }
              className="mx-4"
            />
          ) : (
            <RecentUploadsList
              uploads={uploads ?? []}
              isLoading={isLoading}
              onDelete={setDeleteTarget}
            />
          )}
        </CardContent>
      </Card>

      <DeleteUploadDialog
        upload={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />
    </PageContainer>
  );
}
