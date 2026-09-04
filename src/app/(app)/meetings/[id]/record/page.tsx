"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SearchX } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MeetingWorkspaceSkeleton } from "@/components/meetings/workspace/meeting-workspace-skeleton";
import { MicrophoneRecorderPanel } from "@/components/meetings/recording/microphone-recorder-panel";
import { useMeeting } from "@/features/meetings/hooks/use-meeting";
import { useUploads } from "@/features/uploads/hooks/use-uploads";

type RecordMeetingPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Dedicated recorder for a meeting created with `source_type:
 * "microphone-recording"` (see `getPostCreateRoute`). Redirects to the
 * meeting workspace if the meeting isn't a microphone recording, or already
 * has a recording attached — recording over an already-processed meeting is
 * out of scope, and this keeps the page safe to reload or link back to.
 */
export default function RecordMeetingPage({ params }: RecordMeetingPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: meeting, isLoading, isError } = useMeeting(id);
  const { data: uploads, isLoading: isUploadsLoading } = useUploads({
    enabled: Boolean(meeting),
  });
  const recordingUpload = uploads?.find((upload) => upload.meetingId === id);

  const shouldRedirectToWorkspace =
    Boolean(meeting) &&
    (meeting!.sourceType !== "microphone-recording" || Boolean(recordingUpload));

  useEffect(() => {
    if (shouldRedirectToWorkspace) {
      router.replace(`/meetings/${id}`);
    }
  }, [shouldRedirectToWorkspace, id, router]);

  if (isLoading || (meeting && isUploadsLoading) || shouldRedirectToWorkspace) {
    return <MeetingWorkspaceSkeleton />;
  }

  if (isError || !meeting) {
    return (
      <PageContainer size="wide" className="py-16">
        <EmptyState
          icon={<SearchX />}
          title="Meeting not found"
          description="This meeting doesn't exist or you don't have access to it."
          action={
            <Button size="sm" onClick={() => router.push("/meetings")}>
              Back to meetings
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide" className="py-8">
      <MicrophoneRecorderPanel meetingId={id} meetingTitle={meeting.title} />
    </PageContainer>
  );
}
