"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileWarning, SearchX } from "lucide-react";
import { toast } from "sonner";

import { ConversationExportControl } from "@/components/meetings/conversation/conversation-export-control";
import { ConversationView } from "@/components/meetings/conversation/conversation-view";
import { DownloadsPanel } from "@/components/meetings/downloads/downloads-panel";
import { MeetingInfoPanel } from "@/components/meetings/info-panel/meeting-info-panel";
import { MeetingNotesViewer } from "@/components/meetings/notes/meeting-notes-viewer";
import { SpeakersSection } from "@/components/meetings/notes/speakers-section";
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
import { useRetryProcessing } from "@/features/processing/hooks/use-retry-processing";
import { useTranscript } from "@/features/transcripts/hooks/use-transcript";
import { useNormalizeTranscript } from "@/features/transcripts/hooks/use-normalize-transcript";
import { useTranslateTranscript } from "@/features/transcripts/hooks/use-translate-transcript";
import { useExportConversation } from "@/features/transcripts/hooks/use-export-conversation";
import { useSendConversationEmail } from "@/features/transcripts/hooks/use-send-conversation-email";
import { TRANSLATION_LANGUAGES } from "@/features/transcripts/types";
import type {
  ConversationExportFormat,
  TranslationLanguage,
} from "@/features/transcripts/types";
import { useSummary } from "@/features/summaries/hooks/use-summary";
import { useRegenerateSummary } from "@/features/summaries/hooks/use-regenerate-summary";
import { useMeetingNotes } from "@/features/meeting-notes/hooks/use-meeting-notes";
import { useUpdateMeetingNotes } from "@/features/meeting-notes/hooks/use-update-meeting-notes";
import { useExportMeetingNotes } from "@/features/meeting-notes/hooks/use-export-meeting-notes";
import { useSendMeetingNotesEmail } from "@/features/meeting-notes/hooks/use-send-meeting-notes-email";
import { toMeetingNotesUpdateRequest } from "@/features/meeting-notes/mappers";
import type { MeetingNotesExportFormat } from "@/features/meeting-notes/types";
import { GuestUpgradeDialog } from "@/components/guest/guest-upgrade-dialog";
import { useGuestGate } from "@/features/guest/use-guest-gate";
import { useGuestMeetingsStore } from "@/features/guest/guest-meetings-store";
import { useAuthStore } from "@/store/auth-store";

type MeetingPageProps = {
  params: Promise<{ id: string }>;
};

export default function MeetingPage({ params }: MeetingPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const ownEmail = useAuthStore((state) => state.user?.email);
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
  const retryProcessing = useRetryProcessing();

  const {
    data: transcript,
    isLoading: isTranscriptLoading,
    isError: isTranscriptError,
  } = useTranscript(id, {
    enabled: isReady && !isGuest,
    jobStatus: processingJob?.status ?? null,
  });
  const normalizeTranscript = useNormalizeTranscript(id);
  const translateTranscript = useTranslateTranscript(id);
  const exportConversation = useExportConversation(id);
  const sendConversationEmail = useSendConversationEmail(id);
  const [conversationExportFormat, setConversationExportFormat] =
    useState<ConversationExportFormat>("pdf");

  const { data: summary, isLoading: isSummaryLoading } = useSummary(id, {
    enabled: isReady && !isGuest,
    jobStatus: processingJob?.status ?? null,
  });
  const regenerateSummary = useRegenerateSummary(id);

  const {
    data: meetingNotes,
    isLoading: isMeetingNotesLoading,
    isError: isMeetingNotesError,
  } = useMeetingNotes(id, {
    enabled: isReady && !isGuest,
    jobStatus: processingJob?.status ?? null,
  });
  const updateMeetingNotes = useUpdateMeetingNotes(id);
  const exportMeetingNotes = useExportMeetingNotes(id);
  const sendMeetingNotesEmail = useSendMeetingNotesEmail(id);
  const [meetingNotesEditMode, setMeetingNotesEditMode] = useState(false);
  const [meetingNotesExportFormat, setMeetingNotesExportFormat] =
    useState<MeetingNotesExportFormat>("pdf");

  const activity = useMemo<ActivityItem[]>(() => {
    if (!meeting) return [];

    const items: ActivityItem[] = [
      {
        id: "meeting-created",
        type: "meeting-created",
        timestamp: meeting.createdAt,
      },
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
          id:
            processingJob.status === "failed"
              ? "processing-failed"
              : "processing-completed",
          type:
            processingJob.status === "failed"
              ? "processing-failed"
              : "processing-completed",
          timestamp: processingJob.completedAt,
        });
      }
    }

    return items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [meeting, processingJob]);

  const [activeTab, setActiveTab] = useState<WorkspaceTabValue>("overview");
  const [renameTarget, setRenameTarget] = useState<Meeting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);

  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [transcriptEditMode, setTranscriptEditMode] = useState(false);
  const [transcriptView, setTranscriptView] = useState<
    "raw" | "normalized" | "translated"
  >("raw");
  const [translationLanguage, setTranslationLanguage] =
    useState<TranslationLanguage>("en");
  // Edits are local-only (no persistence endpoint yet); reset whenever the
  // fetched transcript changes so a fresh/retried result isn't shadowed by
  // stale edits made against the previous one.
  const [editedBlocks, setEditedBlocks] = useState<
    TranscriptBlockData[] | null
  >(null);
  const [lastTranscriptId, setLastTranscriptId] = useState<string | undefined>(
    transcript?.id,
  );
  if (transcript?.id !== lastTranscriptId) {
    setLastTranscriptId(transcript?.id);
    setEditedBlocks(null);
    setTranscriptView("raw");
    // Seed the language selector from the persisted translation (if any) so
    // a reload shows the translation that's actually stored, instead of
    // always defaulting to "en" and hiding it behind a mismatched selector.
    const persistedLanguage = transcript?.translatedLanguage;
    setTranslationLanguage(
      TRANSLATION_LANGUAGES.some(
        (language) => language.value === persistedLanguage,
      )
        ? (persistedLanguage as TranslationLanguage)
        : "en",
    );
  }
  const transcriptBlocks = editedBlocks ?? transcript?.blocks ?? [];
  const hasNormalizedTranscript = Boolean(transcript?.normalizedBlocks);
  const hasTranslatedTranscript =
    Boolean(transcript?.translatedBlocks) &&
    transcript?.translatedLanguage === translationLanguage;
  const displayedTranscriptBlocks =
    transcriptView === "normalized"
      ? (transcript?.normalizedBlocks ?? [])
      : transcriptView === "translated"
        ? (transcript?.translatedBlocks ?? [])
        : transcriptBlocks;

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

  function handleRetryProcessing() {
    if (!processingJob || retryProcessing.isPending) return;
    retryProcessing.mutate(processingJob.id, {
      onError: (mutationError) => {
        toast.error(extractErrorMessage(mutationError));
      },
    });
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
            onRename={() =>
              guard("rename-meeting", () => setRenameTarget(meeting))
            }
            onDuplicate={() =>
              guard("manage-meeting", () => toast("Duplicate meeting"))
            }
            onArchive={() =>
              guard("manage-meeting", () => toast("Archive meeting"))
            }
            onDelete={() =>
              guard("delete-meeting", () => setDeleteTarget(meeting))
            }
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
            onRetryProcessing={handleRetryProcessing}
            isRetryingProcessing={retryProcessing.isPending}
          />
        )}

        {activeTab === "transcript" && (
          <TranscriptViewer
            blocks={displayedTranscriptBlocks}
            isLoading={isGuest ? false : isTranscriptLoading}
            searchValue={transcriptSearch}
            onSearchChange={setTranscriptSearch}
            editMode={transcriptEditMode}
            onEditModeChange={setTranscriptEditMode}
            onBlockTextChange={
              transcriptView === "normalized" || transcriptView === "translated"
                ? undefined
                : (blockId, text) =>
                    setEditedBlocks((blocks) =>
                      (blocks ?? transcript?.blocks ?? []).map((block) =>
                        block.id === blockId ? { ...block, text } : block,
                      ),
                    )
            }
            onTimestampClick={(seconds) => toast(`Jump to ${seconds}s`)}
            onCopy={() =>
              toast(
                transcriptView === "normalized"
                  ? "Normalized transcript copied"
                  : transcriptView === "translated"
                    ? "Translated transcript copied"
                    : "Transcript copied",
              )
            }
            emptyTitle={
              isTranscriptError ? "Couldn't load transcript" : undefined
            }
            emptyDescription={
              isTranscriptError
                ? "Something went wrong fetching the transcript. Try refreshing the page."
                : undefined
            }
            view={isGuest ? undefined : transcriptView}
            onViewChange={setTranscriptView}
            hasNormalized={hasNormalizedTranscript}
            isNormalizing={normalizeTranscript.isPending}
            onGenerateNormalized={() =>
              guard("manage-meeting", () =>
                normalizeTranscript.mutate(undefined, {
                  onSuccess: () => {
                    setTranscriptView("normalized");
                    toast.success("Normalized transcript generated");
                  },
                  onError: (mutationError) =>
                    toast.error(extractErrorMessage(mutationError)),
                }),
              )
            }
            hasTranslated={hasTranslatedTranscript}
            isTranslating={translateTranscript.isPending}
            translationLanguage={translationLanguage}
            onTranslationLanguageChange={setTranslationLanguage}
            onGenerateTranslation={() =>
              guard("manage-meeting", () =>
                translateTranscript.mutate(translationLanguage, {
                  onSuccess: () => {
                    setTranscriptView("translated");
                    toast.success("Translated transcript generated");
                  },
                  onError: (mutationError) =>
                    toast.error(extractErrorMessage(mutationError)),
                }),
              )
            }
          />
        )}

        {activeTab === "conversation" && (
          <div className="flex flex-col gap-4">
            {!isGuest && (
              <ConversationExportControl
                format={conversationExportFormat}
                onFormatChange={setConversationExportFormat}
                downloading={exportConversation.isPending}
                onDownload={() =>
                  exportConversation.mutate(conversationExportFormat, {
                    onSuccess: (format) =>
                      toast.success(`${format.toUpperCase()} downloaded`),
                    onError: (mutationError) =>
                      toast.error(extractErrorMessage(mutationError)),
                  })
                }
                ownEmail={ownEmail}
                sendingEmail={sendConversationEmail.isPending}
                onSendEmail={async ({ sendToMe, recipients }) => {
                  if (sendConversationEmail.isPending) return;
                  const result = await sendConversationEmail.mutateAsync({
                    format: conversationExportFormat,
                    sendToMe,
                    recipients,
                  });
                  const count = result.recipients.length;
                  toast.success(
                    `${result.format.toUpperCase()} emailed to ${count} recipient${count === 1 ? "" : "s"}`,
                  );
                }}
              />
            )}
            <ConversationView
              blocks={displayedTranscriptBlocks}
              isLoading={isGuest ? false : isTranscriptLoading}
              onTimestampClick={(seconds) => toast(`Jump to ${seconds}s`)}
              emptyTitle={
                isTranscriptError ? "Couldn't load transcript" : undefined
              }
              emptyDescription={
                isTranscriptError
                  ? "Something went wrong fetching the transcript. Try refreshing the page."
                  : undefined
              }
            />
          </div>
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

        {activeTab === "notes" &&
          (isMeetingNotesError ? (
            <EmptyState
              icon={<FileWarning />}
              title="Couldn't load meeting notes"
              description="Something went wrong fetching meeting notes. Try refreshing the page."
            />
          ) : (
            <div className="flex flex-col gap-6">
              <MeetingNotesViewer
                title={meeting.title}
                dateTimeIst={meetingNotes?.dateTimeIst}
                durationSeconds={
                  meetingNotes?.durationSeconds ?? meeting.durationSeconds
                }
                executiveSummary={meetingNotes?.executiveSummary}
                discussionTopics={meetingNotes?.discussionTopics}
                decisions={meetingNotes?.decisions}
                actionItems={meetingNotes?.actionItems}
                risks={meetingNotes?.risks}
                openQuestions={meetingNotes?.openQuestions}
                nextSteps={meetingNotes?.nextSteps}
                detailedDiscussion={meetingNotes?.detailedDiscussion}
                timestampedDiscussion={meetingNotes?.timestampedDiscussion}
                fullTranscript={meetingNotes?.fullTranscript}
                loading={isGuest ? false : isMeetingNotesLoading}
                onTimestampClick={(seconds) => toast(`Jump to ${seconds}s`)}
                onCopy={() => toast("Meeting notes copied")}
                onCopyTranscript={() => toast("Transcript copied")}
                editMode={isGuest ? false : meetingNotesEditMode}
                onEditModeChange={
                  isGuest || !meetingNotes
                    ? undefined
                    : (editMode) =>
                        guard("manage-meeting", () =>
                          setMeetingNotesEditMode(editMode),
                        )
                }
                saving={updateMeetingNotes.isPending}
                onSave={(draft) =>
                  updateMeetingNotes.mutate(
                    toMeetingNotesUpdateRequest(draft),
                    {
                      onSuccess: () => {
                        setMeetingNotesEditMode(false);
                        toast.success("Meeting notes saved");
                      },
                      onError: (mutationError) =>
                        toast.error(extractErrorMessage(mutationError)),
                    },
                  )
                }
                exportFormat={
                  isGuest || !meetingNotes
                    ? undefined
                    : meetingNotesExportFormat
                }
                onExportFormatChange={setMeetingNotesExportFormat}
                downloading={exportMeetingNotes.isPending}
                onDownload={() =>
                  exportMeetingNotes.mutate(meetingNotesExportFormat, {
                    onSuccess: (format) =>
                      toast.success(`${format.toUpperCase()} downloaded`),
                    onError: (mutationError) =>
                      toast.error(extractErrorMessage(mutationError)),
                  })
                }
                ownEmail={ownEmail}
                sendingEmail={sendMeetingNotesEmail.isPending}
                onSendEmail={async ({ sendToMe, recipients }) => {
                  if (sendMeetingNotesEmail.isPending) return;
                  const result = await sendMeetingNotesEmail.mutateAsync({
                    format: meetingNotesExportFormat,
                    sendToMe,
                    recipients,
                  });
                  const count = result.recipients.length;
                  toast.success(
                    `${result.format.toUpperCase()} emailed to ${count} recipient${count === 1 ? "" : "s"}`,
                  );
                }}
              />

              {!isGuest && <SpeakersSection meetingId={id} enabled={isReady} />}
            </div>
          ))}

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
