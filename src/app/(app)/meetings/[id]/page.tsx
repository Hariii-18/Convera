"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchX } from "lucide-react";
import { toast } from "sonner";

import { DownloadsPanel } from "@/components/meetings/downloads/downloads-panel";
import { MeetingInfoPanel } from "@/components/meetings/info-panel/meeting-info-panel";
import { MeetingOverview } from "@/components/meetings/overview/meeting-overview";
import { SummaryViewer } from "@/components/meetings/summary/summary-viewer";
import { TimelineViewer } from "@/components/meetings/timeline/timeline-viewer";
import { TranscriptViewer } from "@/components/meetings/transcript/transcript-viewer";
import { MeetingWorkspaceLayout } from "@/components/meetings/workspace/meeting-workspace-layout";
import { MeetingWorkspaceSkeleton } from "@/components/meetings/workspace/meeting-workspace-skeleton";
import { WorkspaceHeader } from "@/components/meetings/workspace/workspace-header";
import { WorkspaceNavigation } from "@/components/meetings/workspace/workspace-navigation";
import type { WorkspaceTabValue } from "@/components/meetings/workspace/workspace-tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/layout/page-container";
import { RenameMeetingDialog } from "@/components/meetings/rename-meeting-dialog";
import { DeleteMeetingDialog } from "@/components/meetings/delete-meeting-dialog";
import type { Meeting } from "@/components/meetings/types";
import type { ActionItemData } from "@/components/meetings/summary/types";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";
import type { ActivityItem } from "@/components/meetings/overview/types";
import { extractErrorMessage } from "@/features/auth/error";
import { useMeeting } from "@/features/meetings/hooks/use-meeting";
import { useUpdateMeeting } from "@/features/meetings/hooks/use-update-meeting";
import { useDeleteMeeting } from "@/features/meetings/hooks/use-delete-meeting";
import { useProcessingJob } from "@/features/processing/hooks/use-processing-job";
import { useTranscript } from "@/features/transcripts/hooks/use-transcript";
import { useSummary } from "@/features/summaries/hooks/use-summary";
import { useRegenerateSummary } from "@/features/summaries/hooks/use-regenerate-summary";
import { GuestUpgradeDialog } from "@/components/guest/guest-upgrade-dialog";
import { useGuestGate } from "@/features/guest/use-guest-gate";
import { useGuestMeetingsStore } from "@/features/guest/guest-meetings-store";

type MeetingPageProps = {
  params: Promise<{ id: string }>;
};

export default function MeetingPage({ params }: MeetingPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { isGuest, isReady, pendingAction, guard, closeDialog } =
    useGuestGate();
  const guestMeeting = useGuestMeetingsStore((state) => state.getMeeting(id));

  const {
    data: fetchedMeeting,
    isLoading,
    isError,
  } = useMeeting(id, { enabled: isReady && !isGuest });
  const meeting = isGuest ? guestMeeting : fetchedMeeting;
  const updateMeeting = useUpdateMeeting(id);
  const deleteMeeting = useDeleteMeeting();

  const { data: processingJob, isLoading: isProcessingJobLoading } =
    useProcessingJob(id, { enabled: isReady && !isGuest });

  const {
    data: transcript,
    isLoading: isTranscriptLoading,
    isError: isTranscriptError,
  } = useTranscript(id, {
    enabled: isReady && !isGuest,
    jobStatus: processingJob?.status ?? null,
  });

  const {
    data: summary,
    isLoading: isSummaryLoading,
  } = useSummary(id, { enabled: isReady && !isGuest });
  const regenerateSummary = useRegenerateSummary(id);

  const activity = useMemo<ActivityItem[]>(() => {
    if (!meeting) return [];

    const items: ActivityItem[] = [
      { id: "meeting-created", type: "meeting-created", timestamp: meeting.createdAt },
    ];

    if (processingJob) {
      items.push({
        id: "recording-uploaded",
        type: "recording-uploaded",
        timestamp: processingJob.createdAt,
      });
      items.push({
        id: "queued",
        type: "queued",
        timestamp: processingJob.createdAt,
      });
      if (processingJob.startedAt) {
        items.push({
          id: "processing-started",
          type: "processing-started",
          timestamp: processingJob.startedAt,
        });
      }
      if (processingJob.completedAt) {
        items.push({
          id: processingJob.status === "failed" ? "processing-failed" : "processing-completed",
          type: processingJob.status === "failed" ? "processing-failed" : "processing-completed",
          timestamp: processingJob.completedAt,
        });
      }
    }

    return items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [meeting, processingJob]);

  const [activeTab, setActiveTab] = useState<WorkspaceTabValue>("overview");
  const [renameTarget, setRenameTarget] = useState<Meeting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);

  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [transcriptEditMode, setTranscriptEditMode] = useState(false);
  // Edits are local-only (no persistence endpoint yet); reset whenever the
  // fetched transcript changes so a fresh/retried result isn't shadowed by
  // stale edits made against the previous one.
  const [editedBlocks, setEditedBlocks] = useState<TranscriptBlockData[] | null>(
    null,
  );
  const [lastTranscriptId, setLastTranscriptId] = useState<string | undefined>(
    transcript?.id,
  );
  if (transcript?.id !== lastTranscriptId) {
    setLastTranscriptId(transcript?.id);
    setEditedBlocks(null);
  }
  const transcriptBlocks = editedBlocks ?? transcript?.blocks ?? [];

  // Action item completion toggles are local-only (no persistence endpoint
  // yet); reset whenever a fresh/regenerated summary comes in so stale
  // toggles from the previous summary don't shadow it.
  const [editedActionItems, setEditedActionItems] = useState<
    ActionItemData[] | null
  >(null);
  const [lastSummaryId, setLastSummaryId] = useState<string | undefined>(
    summary?.id,
  );
  if (summary?.id !== lastSummaryId) {
    setLastSummaryId(summary?.id);
    setEditedActionItems(null);
  }
  const actionItems = editedActionItems ?? summary?.actionItems ?? [];

  const [timelineSearch, setTimelineSearch] = useState("");
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  function handleRenameConfirm(title: string) {
    updateMeeting.mutate(
      { title },
      {
        onSuccess: () => {
          toast.success("Meeting renamed");
          setRenameTarget(null);
        },
        onError: (mutationError) => {
          toast.error(extractErrorMessage(mutationError));
        },
      },
    );
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteMeeting.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Meeting deleted");
        setDeleteTarget(null);
        router.push("/meetings");
      },
      onError: (mutationError) => {
        toast.error(extractErrorMessage(mutationError));
      },
    });
  }

  if (!isReady || isLoading) {
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
    <>
      <MeetingWorkspaceLayout
        header={
          <WorkspaceHeader
            title={meeting.title}
            status={meeting.status}
            durationSeconds={meeting.durationSeconds}
            createdAt={meeting.createdAt}
            onExport={() => toast("Export meeting")}
            onRename={() => guard("rename-meeting", () => setRenameTarget(meeting))}
            onDuplicate={() =>
              guard("manage-meeting", () => toast("Duplicate meeting"))
            }
            onArchive={() =>
              guard("manage-meeting", () => toast("Archive meeting"))
            }
            onDelete={() => guard("delete-meeting", () => setDeleteTarget(meeting))}
          />
        }
        navigation={
          <WorkspaceNavigation value={activeTab} onValueChange={setActiveTab} />
        }
        activeTab={activeTab}
        sidePanel={<MeetingInfoPanel />}
      >
        {activeTab === "overview" && (
          <MeetingOverview
            metadata={{
              title: meeting.title,
              status: meeting.status,
              durationSeconds: meeting.durationSeconds,
              createdAt: meeting.createdAt,
              updatedAt: meeting.updatedAt,
            }}
            activity={activity}
            processingJob={isGuest ? null : processingJob}
            processingJobLoading={isGuest ? false : isProcessingJobLoading}
            onViewFullSummary={() => setActiveTab("summary")}
            onViewTimeline={() => setActiveTab("timeline")}
            onDownloadRecording={() => toast("Download recording")}
          />
        )}

        {activeTab === "transcript" && (
          <TranscriptViewer
            blocks={transcriptBlocks}
            isLoading={isGuest ? false : isTranscriptLoading}
            searchValue={transcriptSearch}
            onSearchChange={setTranscriptSearch}
            editMode={transcriptEditMode}
            onEditModeChange={setTranscriptEditMode}
            onBlockTextChange={(blockId, text) =>
              setEditedBlocks((blocks) =>
                (blocks ?? transcript?.blocks ?? []).map((block) =>
                  block.id === blockId ? { ...block, text } : block,
                ),
              )
            }
            onTimestampClick={(seconds) => toast(`Jump to ${seconds}s`)}
            onCopy={() => toast("Transcript copied")}
            emptyTitle={isTranscriptError ? "Couldn't load transcript" : undefined}
            emptyDescription={
              isTranscriptError
                ? "Something went wrong fetching the transcript. Try refreshing the page."
                : undefined
            }
          />
        )}

        {activeTab === "summary" && (
          <SummaryViewer
            executiveSummary={summary?.executiveSummary}
            topics={summary?.topics}
            decisions={summary?.decisions}
            actionItems={actionItems}
            risks={summary?.risks}
            openQuestions={summary?.openQuestions}
            nextSteps={summary?.nextSteps}
            loading={
              isGuest ? false : isSummaryLoading || regenerateSummary.isPending
            }
            onToggleActionItem={(itemId) =>
              setEditedActionItems(
                actionItems.map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        status:
                          item.status === "completed"
                            ? "not-started"
                            : "completed",
                      }
                    : item,
                ),
              )
            }
            onCopy={() => toast("Summary copied")}
            onExport={() => toast("Export summary")}
            onRegenerate={() =>
              guard("manage-meeting", () =>
                regenerateSummary.mutate(undefined, {
                  onSuccess: () => toast.success("Summary regenerated"),
                  onError: (mutationError) =>
                    toast.error(extractErrorMessage(mutationError)),
                }),
              )
            }
          />
        )}

        {activeTab === "timeline" && (
          <TimelineViewer
            searchValue={timelineSearch}
            onSearchChange={setTimelineSearch}
            expanded={timelineExpanded}
            onExpandedChange={setTimelineExpanded}
            onItemClick={(event) => toast(`Jump to "${event.title}"`)}
          />
        )}

        {activeTab === "downloads" && (
          <DownloadsPanel
            onDownload={(format) => toast(`Download ${format.toUpperCase()}`)}
            onRegenerate={(format) =>
              toast(`Regenerate ${format.toUpperCase()}`)
            }
            onDownloadHistoryEntry={(entry) =>
              toast(`Download ${entry.fileName}`)
            }
          />
        )}
      </MeetingWorkspaceLayout>

      <RenameMeetingDialog
        meeting={renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        onConfirm={handleRenameConfirm}
        isPending={updateMeeting.isPending}
      />

      <DeleteMeetingDialog
        meeting={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMeeting.isPending}
      />

      <GuestUpgradeDialog
        action={pendingAction}
        onOpenChange={(open) => !open && closeDialog()}
      />
    </>
  );
}
