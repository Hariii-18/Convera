"use client";

import { use, useState } from "react";
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
import { extractErrorMessage } from "@/features/auth/error";
import { useMeeting } from "@/features/meetings/hooks/use-meeting";
import { useUpdateMeeting } from "@/features/meetings/hooks/use-update-meeting";
import { useDeleteMeeting } from "@/features/meetings/hooks/use-delete-meeting";

type MeetingPageProps = {
  params: Promise<{ id: string }>;
};

export default function MeetingPage({ params }: MeetingPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: meeting, isLoading, isError } = useMeeting(id);
  const updateMeeting = useUpdateMeeting(id);
  const deleteMeeting = useDeleteMeeting();

  const [activeTab, setActiveTab] = useState<WorkspaceTabValue>("overview");
  const [renameTarget, setRenameTarget] = useState<Meeting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);

  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [transcriptEditMode, setTranscriptEditMode] = useState(false);
  const [transcriptBlocks, setTranscriptBlocks] = useState<
    TranscriptBlockData[]
  >([]);

  const [actionItems, setActionItems] = useState<ActionItemData[]>([]);

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

  if (isLoading) {
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
            onRename={() => setRenameTarget(meeting)}
            onDuplicate={() => toast("Duplicate meeting")}
            onArchive={() => toast("Archive meeting")}
            onDelete={() => setDeleteTarget(meeting)}
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
            onViewFullSummary={() => setActiveTab("summary")}
            onViewTimeline={() => setActiveTab("timeline")}
            onDownloadRecording={() => toast("Download recording")}
          />
        )}

        {activeTab === "transcript" && (
          <TranscriptViewer
            blocks={transcriptBlocks}
            searchValue={transcriptSearch}
            onSearchChange={setTranscriptSearch}
            editMode={transcriptEditMode}
            onEditModeChange={setTranscriptEditMode}
            onBlockTextChange={(blockId, text) =>
              setTranscriptBlocks((blocks) =>
                blocks.map((block) =>
                  block.id === blockId ? { ...block, text } : block,
                ),
              )
            }
            onTimestampClick={(seconds) => toast(`Jump to ${seconds}s`)}
            onCopy={() => toast("Transcript copied")}
          />
        )}

        {activeTab === "summary" && (
          <SummaryViewer
            actionItems={actionItems}
            onToggleActionItem={(id) =>
              setActionItems((items) =>
                items.map((item) =>
                  item.id === id
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
            onRegenerate={() => toast("Regenerate summary")}
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
    </>
  );
}
