"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, History, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteUploadDialog } from "@/components/uploads/delete-upload-dialog";
import { RecentUploadsList } from "@/components/uploads/recent-uploads-list";
import { StartUploadDialog } from "@/components/uploads/start-upload-dialog";
import { UploadDialog } from "@/components/uploads/upload-dialog";
import { extractErrorMessage } from "@/features/auth/error";
import { useGuestSession } from "@/features/guest/guest-provider";
import { useDeleteUpload } from "@/features/uploads/hooks/use-delete-upload";
import { useUploads } from "@/features/uploads/hooks/use-uploads";
import type { Upload } from "@/features/uploads/mappers";
import { useCreateMeeting } from "@/features/meetings/hooks/use-create-meeting";
import { useMeetings } from "@/features/meetings/hooks/use-meetings";
import { toMeeting } from "@/features/meetings/mappers";
import type { Meeting } from "@/components/meetings/types";

export default function UploadsPage() {
  const router = useRouter();
  const { isGuest, isReady } = useGuestSession();

  const [deleteTarget, setDeleteTarget] = useState<Upload | null>(null);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<Meeting | null>(null);

  const {
    data: uploads,
    isLoading,
    isError,
    error,
    refetch,
  } = useUploads({ enabled: isReady && !isGuest });
  const { data: meetings } = useMeetings({ enabled: isReady && !isGuest });
  const createMeeting = useCreateMeeting();
  const deleteMutation = useDeleteUpload();

  const meetingsById = useMemo(() => {
    const map = new Map<string, Meeting>();
    for (const meeting of meetings ?? []) map.set(meeting.id, meeting);
    return map;
  }, [meetings]);

  const linkedUploads = useMemo(
    () => (uploads ?? []).filter((upload) => upload.meetingId),
    [uploads],
  );

  function handleViewUpload(upload: Upload) {
    if (upload.meetingId) router.push(`/meetings/${upload.meetingId}`);
  }

  function handleSelectExisting(meetingId: string) {
    const meeting = meetingsById.get(meetingId);
    if (!meeting) return;
    setStartDialogOpen(false);
    setUploadTarget(meeting);
  }

  function handleCreateNew(title: string) {
    createMeeting.mutate(
      { title, source_type: "upload-recording" },
      {
        onSuccess: (meeting) => {
          setStartDialogOpen(false);
          setUploadTarget(toMeeting(meeting));
        },
        onError: (mutationError) => {
          toast.error(extractErrorMessage(mutationError));
        },
      },
    );
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

  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Uploads"
        description="Upload an existing recording to have it processed."
        action={
          <Button size="sm" onClick={() => setStartDialogOpen(true)}>
            <UploadCloud data-icon="inline-start" />
            Upload recording
          </Button>
        }
      />

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
              uploads={linkedUploads}
              meetingsById={meetingsById}
              isLoading={isLoading}
              onView={handleViewUpload}
              onDelete={setDeleteTarget}
            />
          )}
        </CardContent>
      </Card>

      <StartUploadDialog
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        meetings={meetings ?? []}
        isCreatingMeeting={createMeeting.isPending}
        onSelectExisting={handleSelectExisting}
        onCreateNew={handleCreateNew}
      />

      {uploadTarget && (
        <UploadDialog
          open={Boolean(uploadTarget)}
          onOpenChange={(open) => !open && setUploadTarget(null)}
          meetingId={uploadTarget.id}
          meetingTitle={uploadTarget.title}
        />
      )}

      <DeleteUploadDialog
        upload={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />
    </PageContainer>
  );
}
