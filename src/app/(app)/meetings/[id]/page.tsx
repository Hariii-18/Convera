"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileWarning, SearchX } from "lucide-react";
import { toast } from "sonner";

import { ConversationExportControl } from "@/components/meetings/conversation/conversation-export-control";
import { ConversationView } from "@/components/meetings/conversation/conversation-view";
import { DownloadsPanel } from "@/components/meetings/downloads/downloads-panel";
import type { ExportCardData, ExportFormat } from "@/components/meetings/downloads/types";
import { MeetingInfoPanel } from "@/components/meetings/info-panel/meeting-info-panel";
import type {
  ProcessingInfoData,
  RecordingInfoData,
} from "@/components/meetings/info-panel/types";
import { MeetingNotesViewer } from "@/components/meetings/notes/meeting-notes-viewer";
import { SpeakersSection } from "@/components/meetings/notes/speakers-section";
import { MeetingOverview } from "@/components/meetings/overview/meeting-overview";
import { MeetingMediaPlayer } from "@/components/meetings/player/meeting-media-player";
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
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";
import type {
  ActivityItem,
  MeetingStatisticsData,
  RecordingInfo as OverviewRecordingInfo,
  TimelineEventPreview,
} from "@/components/meetings/overview/types";
import { formatTimestamp } from "@/components/meetings/format";
import { useMediaPlayer } from "@/features/media-player/use-media-player";
import type { MediaPlayerStatus } from "@/features/media-player/use-media-player";
import { extractErrorMessage } from "@/features/auth/error";
import { useUserTimezone } from "@/features/auth/hooks/use-user-timezone";
import { useMeeting } from "@/features/meetings/hooks/use-meeting";
import { useUpdateMeeting } from "@/features/meetings/hooks/use-update-meeting";
import { useDeleteMeeting } from "@/features/meetings/hooks/use-delete-meeting";
import { useProcessingJob } from "@/features/processing/hooks/use-processing-job";
import { useRetryProcessing } from "@/features/processing/hooks/use-retry-processing";
import { isTerminalStatus } from "@/features/processing/mappers";
import { useUploads } from "@/features/uploads/hooks/use-uploads";
import { useUploadPlayback } from "@/features/uploads/hooks/use-upload-playback";
import type { Upload } from "@/features/uploads/mappers";
import { useTranscript } from "@/features/transcripts/hooks/use-transcript";
import { useNormalizeTranscript } from "@/features/transcripts/hooks/use-normalize-transcript";
import { useTranslateTranscript } from "@/features/transcripts/hooks/use-translate-transcript";
import { useUpdateTranscript } from "@/features/transcripts/hooks/use-update-transcript";
import { useExportConversation } from "@/features/transcripts/hooks/use-export-conversation";
import { useSendConversationEmail } from "@/features/transcripts/hooks/use-send-conversation-email";
import { useDownloadTranscript } from "@/features/transcripts/hooks/use-download-transcript";
import { TRANSLATION_LANGUAGES } from "@/features/transcripts/types";
import type {
  ConversationExportFormat,
  TranslationLanguage,
} from "@/features/transcripts/types";
import { useSummary } from "@/features/summaries/hooks/use-summary";
import { useTimeline } from "@/features/timeline/hooks/use-timeline";
import { useMeetingInsights } from "@/features/insights/hooks/use-meeting-insights";
import { useRegenerateSummary } from "@/features/summaries/hooks/use-regenerate-summary";
import { useUpdateActionItem } from "@/features/summaries/hooks/use-update-action-item";
import { useExportSummary } from "@/features/summaries/hooks/use-export-summary";
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
import type { ProcessingJob } from "@/features/processing/mappers";

type MeetingPageProps = {
  params: Promise<{ id: string }>;
};

/** Seconds between a job's start and completion, or `undefined` if either is missing. */
function deriveProcessingTimeSeconds(
  job: ProcessingJob | null | undefined,
): number | undefined {
  if (!job?.startedAt || !job?.completedAt) return undefined;
  const seconds =
    (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000;
  return seconds >= 0 ? seconds : undefined;
}

/**
 * The backend has no explicit transcript/summary status field — it's
 * inferred here from whether the artifact exists plus the processing job's
 * status, matching the pipeline's actual lifecycle
 * (`app/services/pipeline_service.py`: transcript persists first, then
 * normalize/summary/timeline run before the job reaches a terminal state).
 */
function deriveArtifactStatus<T extends string>(
  hasArtifact: boolean,
  job: ProcessingJob | null | undefined,
  generatedLabel: T,
  inProgressLabel: T,
  failedLabel: T,
  pendingLabel: T,
): T | undefined {
  if (hasArtifact) return generatedLabel;
  if (!job) return undefined;
  if (!isTerminalStatus(job.status)) return inProgressLabel;
  return job.status === "failed" ? failedLabel : pendingLabel;
}

/**
 * The backend never records a "screen recording" kind — uploads are
 * audio/video files and Live Meeting captures audio only (see
 * `_LIVE_PLACEHOLDER_MIME_TYPE` in `live_meeting_service.py`) — so this only
 * ever resolves to "audio" or "video", never the third `RecordingType` case.
 */
function deriveRecordingType(mimeType: string | undefined): "audio" | "video" | undefined {
  if (!mimeType) return undefined;
  return mimeType.startsWith("video/") ? "video" : "audio";
}

/**
 * Resolution state for the media player, from the recording upload's own
 * status plus the signed playback-URL fetch. "loading" covers both an
 * upload that's still `uploading`/being processed and a playback URL fetch
 * still in flight — the player shows one skeleton state either way.
 */
function deriveRecordingPlaybackStatus(
  recordingUpload: Upload | undefined,
  isPlaybackLoading: boolean,
  isPlaybackError: boolean,
  playbackUrl: string | undefined,
): MediaPlayerStatus {
  if (!recordingUpload) return "unavailable";
  if (recordingUpload.status !== "uploaded") return "loading";
  if (isPlaybackError) return "error";
  if (isPlaybackLoading || !playbackUrl) return "loading";
  return "ready";
}

export default function MeetingPage({ params }: MeetingPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const ownEmail = useAuthStore((state) => state.user?.email);
  const timeZone = useUserTimezone();
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

  // The upload behind this meeting's recording. Not looked up via
  // `processingJob.uploadId` — Live Meeting finalization persists a
  // transcript straight through `run_post_transcription_pipeline` without
  // ever creating a `ProcessingJob` row (see `live_meeting_service.
  // finalize_live_meeting`), so a live meeting would never have a
  // processing job to key off of. `Upload.meeting_id` is always set
  // correctly on both paths, so matching on that covers both; uploads are
  // returned newest-first, so the first match is the current recording.
  const { data: uploads } = useUploads({ enabled: isReady && !isGuest });
  const recordingUpload = uploads?.find((upload) => upload.meetingId === id);

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
  const updateTranscript = useUpdateTranscript(id);
  const exportConversation = useExportConversation(id);
  const sendConversationEmail = useSendConversationEmail(id);
  const [conversationExportFormat, setConversationExportFormat] =
    useState<ConversationExportFormat>("pdf");

  const { data: summary, isLoading: isSummaryLoading } = useSummary(id, {
    enabled: isReady && !isGuest,
    jobStatus: processingJob?.status ?? null,
  });
  const regenerateSummary = useRegenerateSummary(id);
  const exportSummary = useExportSummary(id);

  const { data: timelineEvents, isLoading: isTimelineLoading } = useTimeline(id, {
    enabled: isReady && !isGuest,
    jobStatus: processingJob?.status ?? null,
  });

  const {
    data: insights,
    isLoading: isInsightsLoading,
    isError: isInsightsError,
  } = useMeetingInsights(id, {
    enabled: isReady && !isGuest,
    jobStatus: processingJob?.status ?? null,
  });

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

  const downloadTranscript = useDownloadTranscript();
  const [downloadingExportFormat, setDownloadingExportFormat] =
    useState<ExportFormat | null>(null);

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

  // Meeting.duration_seconds is never populated by the backend today (see
  // app/models/meeting.py — no write path sets it); the transcript's own
  // duration is the real fallback, same as `meeting_notes_service` uses.
  const recordingDurationSeconds =
    meeting?.durationSeconds ??
    (transcript?.duration != null ? Math.round(transcript.duration) : null);

  const recordingType = deriveRecordingType(recordingUpload?.mimeType);

  const {
    data: playback,
    isLoading: isPlaybackLoading,
    isError: isPlaybackError,
  } = useUploadPlayback(recordingUpload?.id, {
    enabled: isReady && !isGuest && recordingUpload?.status === "uploaded",
  });

  const player = useMediaPlayer({
    mediaType: recordingType,
    status: deriveRecordingPlaybackStatus(
      recordingUpload,
      isPlaybackLoading,
      isPlaybackError,
      playback?.url,
    ),
    playbackUrl: playback?.url,
  });

  const overviewStatistics: MeetingStatisticsData = {
    transcriptWordCount: transcript?.wordCount,
    processingTimeSeconds: deriveProcessingTimeSeconds(processingJob),
    summaryStatus: deriveArtifactStatus(
      Boolean(summary),
      processingJob,
      "generated",
      "generating",
      "failed",
      "pending",
    ),
    recordingSizeBytes: recordingUpload?.sizeBytes,
  };

  // `audioQuality` (e.g. "High · 48kHz") has no backend source — the upload
  // record carries no bitrate/sample-rate data — so it's left unset rather
  // than invented.
  const overviewRecording: OverviewRecordingInfo | undefined = recordingType
    ? { type: recordingType, durationSeconds: recordingDurationSeconds }
    : undefined;

  const timelinePreviewEvents = useMemo<TimelineEventPreview[]>(
    () =>
      (timelineEvents ?? []).map((event) => ({
        id: event.id,
        label: event.title,
        timeLabel: formatTimestamp(event.timestampSeconds),
        description: event.description,
      })),
    [timelineEvents],
  );

  // Participants/tags have no backing data: `Meeting.participants_count` is
  // just a count (no names/ids to render as a roster), and the backend has
  // no tags concept at all — so `MeetingInfoPanel` gets neither, rather than
  // fabricated entries.
  const infoPanelRecording: RecordingInfoData | undefined = recordingType
    ? {
        type: recordingType,
        durationSeconds: recordingDurationSeconds,
        sizeBytes: recordingUpload?.sizeBytes,
      }
    : undefined;

  const infoPanelProcessing: ProcessingInfoData = {
    processingTimeSeconds: deriveProcessingTimeSeconds(processingJob),
    transcriptStatus: deriveArtifactStatus(
      Boolean(transcript),
      processingJob,
      "completed",
      "processing",
      "failed",
      "pending",
    ),
    summaryStatus: deriveArtifactStatus(
      Boolean(summary),
      processingJob,
      "generated",
      "generating",
      "failed",
      "pending",
    ),
  };

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
  // In-progress edit draft, applied only on Save (see `updateTranscript`
  // below) — reset whenever the fetched transcript changes so a
  // fresh/retried result, or a just-saved one, isn't shadowed by stale
  // edits made against the previous one.
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

  const updateActionItem = useUpdateActionItem(id);
  const actionItems = summary?.actionItems ?? [];

  const [timelineSearch, setTimelineSearch] = useState("");
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  const exportItems = useMemo<ExportCardData[]>(() => {
    if (isGuest) return [];
    const items: ExportCardData[] = [];
    if (meetingNotes) items.push({ format: "pdf" }, { format: "docx" });
    if (transcript) items.push({ format: "txt" }, { format: "json" });
    return items;
  }, [isGuest, meetingNotes, transcript]);

  function handleDownloadExport(format: ExportFormat) {
    if (downloadingExportFormat || !meeting) return;
    setDownloadingExportFormat(format);
    if (format === "pdf" || format === "docx") {
      exportMeetingNotes.mutate(format, {
        onSuccess: (downloaded) =>
          toast.success(`${downloaded.toUpperCase()} downloaded`),
        onError: (mutationError) =>
          toast.error(extractErrorMessage(mutationError)),
        onSettled: () => setDownloadingExportFormat(null),
      });
      return;
    }
    downloadTranscript.mutate(
      { meetingId: id, format, fileName: `${meeting.title}.${format}` },
      {
        onSuccess: () => toast.success(`${format.toUpperCase()} downloaded`),
        onError: (mutationError) =>
          toast.error(extractErrorMessage(mutationError)),
        onSettled: () => setDownloadingExportFormat(null),
      },
    );
  }

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
            timeZone={timeZone}
            onExport={() =>
              guard("export-meeting", () =>
                exportMeetingNotes.mutate(meetingNotesExportFormat, {
                  onSuccess: (downloaded) =>
                    toast.success(`${downloaded.toUpperCase()} downloaded`),
                  onError: (mutationError) =>
                    toast.error(extractErrorMessage(mutationError)),
                }),
              )
            }
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
        mediaPlayer={<MeetingMediaPlayer player={player} />}
        sidePanel={
          <MeetingInfoPanel
            recording={isGuest ? undefined : infoPanelRecording}
            processing={isGuest ? undefined : infoPanelProcessing}
            insights={isGuest ? undefined : insights}
            insightsLoading={isGuest ? false : isInsightsLoading}
            insightsError={isGuest ? false : isInsightsError}
          />
        }
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
            timeZone={timeZone}
            statistics={isGuest ? undefined : overviewStatistics}
            recording={isGuest ? undefined : overviewRecording}
            summary={isGuest ? undefined : summary?.executiveSummary}
            timelineEvents={isGuest ? undefined : timelinePreviewEvents}
            activity={activity}
            processingJob={isGuest ? null : processingJob}
            processingJobLoading={isGuest ? false : isProcessingJobLoading}
            onViewFullSummary={() => setActiveTab("summary")}
            onViewTimeline={() => setActiveTab("timeline")}
            onDownloadRecording={
              playback?.url
                ? () => {
                    const link = document.createElement("a");
                    link.href = playback.url;
                    link.download = meeting.title;
                    link.rel = "noopener noreferrer";
                    link.target = "_blank";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  }
                : undefined
            }
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
            onEditModeChange={(editMode) =>
              guard("manage-meeting", () => {
                setTranscriptEditMode(editMode);
                if (!editMode) setEditedBlocks(null);
              })
            }
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
            saving={updateTranscript.isPending}
            onSave={() =>
              guard("manage-meeting", () => {
                const blocks = editedBlocks ?? transcript?.blocks ?? [];
                updateTranscript.mutate(
                  { segments: blocks.map((block) => ({ text: block.text })) },
                  {
                    onSuccess: () => {
                      setTranscriptEditMode(false);
                      setEditedBlocks(null);
                      toast.success("Transcript saved");
                    },
                    onError: (mutationError) =>
                      toast.error(extractErrorMessage(mutationError)),
                  },
                );
              })
            }
            onTimestampClick={player.seek}
            activeTimeSeconds={player.isPlaying ? player.currentTime : undefined}
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
              onTimestampClick={player.seek}
              activeTimeSeconds={player.isPlaying ? player.currentTime : undefined}
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
            timeZone={timeZone}
            loading={
              isGuest ? false : isSummaryLoading || regenerateSummary.isPending
            }
            onToggleActionItem={(itemId) =>
              guard("manage-meeting", () => {
                const index = actionItems.findIndex((item) => item.id === itemId);
                if (index === -1) return;
                const item = actionItems[index];
                if (!item) return;
                updateActionItem.mutate(
                  {
                    index,
                    payload: {
                      // Un-completing clears status back to unknown rather
                      // than asserting "not started" — that's not
                      // something the toggle (or the transcript) actually
                      // established.
                      status: item.status === "completed" ? null : "completed",
                    },
                  },
                  {
                    onSuccess: () => toast.success("Action item updated"),
                    onError: (mutationError) =>
                      toast.error(extractErrorMessage(mutationError)),
                  },
                );
              })
            }
            onSaveActionItem={(itemId, edits) =>
              guard("manage-meeting", () => {
                const index = actionItems.findIndex((item) => item.id === itemId);
                if (index === -1) return;
                updateActionItem.mutate(
                  {
                    index,
                    payload: {
                      text: edits.text,
                      owner: edits.owner,
                      due_date: edits.dueDate,
                      status: edits.status,
                    },
                  },
                  {
                    onSuccess: () => toast.success("Action item updated"),
                    onError: (mutationError) =>
                      toast.error(extractErrorMessage(mutationError)),
                  },
                );
              })
            }
            pendingActionItemId={
              updateActionItem.isPending
                ? (actionItems[updateActionItem.variables?.index ?? -1]?.id ?? null)
                : null
            }
            onCopy={() => toast("Summary copied")}
            onExport={(format) =>
              guard("export-meeting", () =>
                exportSummary.mutate(format, {
                  onSuccess: (downloaded) =>
                    toast.success(`${downloaded.toUpperCase()} downloaded`),
                  onError: (mutationError) =>
                    toast.error(extractErrorMessage(mutationError)),
                }),
              )
            }
            exporting={exportSummary.isPending}
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
            events={isGuest ? [] : timelineEvents}
            isLoading={isGuest ? false : isTimelineLoading}
            searchValue={timelineSearch}
            onSearchChange={setTimelineSearch}
            expanded={timelineExpanded}
            onExpandedChange={setTimelineExpanded}
            onItemClick={(event) => player.seek(event.timestampSeconds)}
            activeTimeSeconds={player.isPlaying ? player.currentTime : undefined}
          />
        )}

        {activeTab === "downloads" && (
          <DownloadsPanel
            exports={exportItems}
            loading={isMeetingNotesLoading || isTranscriptLoading}
            downloadingFormats={
              downloadingExportFormat ? [downloadingExportFormat] : []
            }
            onDownload={handleDownloadExport}
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
