"use client";

import { use, useState } from "react";
import { toast } from "sonner";

import { DownloadsPanel } from "@/components/meetings/downloads/downloads-panel";
import { MeetingInfoPanel } from "@/components/meetings/info-panel/meeting-info-panel";
import { MeetingOverview } from "@/components/meetings/overview/meeting-overview";
import { SummaryViewer } from "@/components/meetings/summary/summary-viewer";
import { TimelineViewer } from "@/components/meetings/timeline/timeline-viewer";
import { TranscriptViewer } from "@/components/meetings/transcript/transcript-viewer";
import { MeetingWorkspaceLayout } from "@/components/meetings/workspace/meeting-workspace-layout";
import { WorkspaceHeader } from "@/components/meetings/workspace/workspace-header";
import { WorkspaceNavigation } from "@/components/meetings/workspace/workspace-navigation";
import type { WorkspaceTabValue } from "@/components/meetings/workspace/workspace-tabs";
import {
  mockDownloadsExports,
  mockDownloadsHistory,
  mockInfoPanelParticipants,
  mockInfoPanelProcessing,
  mockInfoPanelRecording,
  mockInfoPanelTags,
  mockMeetingMetadata,
  mockOverviewActivity,
  mockOverviewRecording,
  mockOverviewStatistics,
  mockOverviewSummary,
  mockOverviewTimelineEvents,
  mockSummaryActionItems,
  mockSummaryDecisions,
  mockSummaryExecutiveSummary,
  mockSummaryNextSteps,
  mockSummaryOpenQuestions,
  mockSummaryRisks,
  mockSummaryTopics,
  mockTimelineEvents,
  mockTranscriptBlocks,
} from "./mock-data";

type MeetingPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Single-meeting workspace, routed by id. Renders entirely from mock fixtures
 * in `./mock-data` — there is no API yet, so every tab shows the same fixture
 * meeting regardless of `id`.
 */
export default function MeetingPage({ params }: MeetingPageProps) {
  use(params);

  const [activeTab, setActiveTab] = useState<WorkspaceTabValue>("overview");

  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [transcriptEditMode, setTranscriptEditMode] = useState(false);
  const [transcriptBlocks, setTranscriptBlocks] = useState(
    mockTranscriptBlocks,
  );

  const [actionItems, setActionItems] = useState(mockSummaryActionItems);

  const [timelineSearch, setTimelineSearch] = useState("");
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  return (
    <MeetingWorkspaceLayout
      header={
        <WorkspaceHeader
          title={mockMeetingMetadata.title}
          status={mockMeetingMetadata.status}
          durationSeconds={mockMeetingMetadata.durationSeconds}
          createdAt={mockMeetingMetadata.createdAt}
          onExport={() => toast("Export meeting")}
          onRename={() => toast("Rename meeting")}
          onDuplicate={() => toast("Duplicate meeting")}
          onArchive={() => toast("Archive meeting")}
          onDelete={() => toast("Delete meeting")}
        />
      }
      navigation={
        <WorkspaceNavigation value={activeTab} onValueChange={setActiveTab} />
      }
      activeTab={activeTab}
      sidePanel={
        <MeetingInfoPanel
          participants={mockInfoPanelParticipants}
          tags={mockInfoPanelTags}
          recording={mockInfoPanelRecording}
          processing={mockInfoPanelProcessing}
        />
      }
    >
      {activeTab === "overview" && (
        <MeetingOverview
          metadata={mockMeetingMetadata}
          statistics={mockOverviewStatistics}
          recording={mockOverviewRecording}
          summary={mockOverviewSummary}
          timelineEvents={mockOverviewTimelineEvents}
          activity={mockOverviewActivity}
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
          executiveSummary={mockSummaryExecutiveSummary}
          topics={mockSummaryTopics}
          decisions={mockSummaryDecisions}
          actionItems={actionItems}
          risks={mockSummaryRisks}
          openQuestions={mockSummaryOpenQuestions}
          nextSteps={mockSummaryNextSteps}
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
          events={mockTimelineEvents}
          searchValue={timelineSearch}
          onSearchChange={setTimelineSearch}
          expanded={timelineExpanded}
          onExpandedChange={setTimelineExpanded}
          onItemClick={(event) => toast(`Jump to "${event.title}"`)}
        />
      )}

      {activeTab === "downloads" && (
        <DownloadsPanel
          exports={mockDownloadsExports}
          history={mockDownloadsHistory}
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
  );
}
