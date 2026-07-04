import type {
  ActivityItem,
  MeetingMetadataData,
  MeetingStatisticsData,
  RecordingInfo,
  TimelineEventPreview,
} from "@/components/meetings/overview/types";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";
import type {
  ActionItemData,
  DecisionData,
  DiscussionTopicData,
  NextStepData,
  OpenQuestionData,
  RiskData,
} from "@/components/meetings/summary/types";
import type { TimelineEventData } from "@/components/meetings/timeline/types";
import type {
  ExportCardData,
  ExportHistoryEntry,
} from "@/components/meetings/downloads/types";
import type {
  MeetingTag,
  Participant,
  ProcessingInfoData,
  RecordingInfoData,
} from "@/components/meetings/info-panel/types";

/**
 * Fixture data for the meeting workspace page. Stands in for a real meeting
 * record until the app has an API to fetch one — every tab and panel renders
 * from these mock props, not from `params.id`.
 */

export const mockMeetingMetadata: MeetingMetadataData = {
  title: "Q3 roadmap sync",
  status: "completed",
  durationSeconds: 2745,
  createdAt: "2026-06-18T15:00:00Z",
  updatedAt: "2026-06-18T16:10:00Z",
};

export const mockOverviewStatistics: MeetingStatisticsData = {
  transcriptWordCount: 4820,
  processingTimeSeconds: 184,
  summaryStatus: "generated",
  recordingSizeBytes: 68_400_000,
};

export const mockOverviewRecording: RecordingInfo = {
  type: "video",
  durationSeconds: 2745,
  audioQuality: "High · 48kHz",
};

export const mockOverviewSummary =
  "The team aligned on Q3 priorities, agreeing to ship the billing revamp before the analytics dashboard. " +
  "Design will finalize the new pricing page mockups by Friday. Engineering flagged a risk around the " +
  "payments migration timeline and will report back after a spike next week.";

export const mockOverviewTimelineEvents: TimelineEventPreview[] = [
  { id: "t1", label: "Meeting started", timeLabel: "00:00" },
  { id: "t2", label: "Q3 priorities discussion", timeLabel: "04:12" },
  {
    id: "t3",
    label: "Billing revamp scope",
    timeLabel: "18:45",
    description: "Agreed to cut the legacy invoice export",
  },
];

export const mockOverviewActivity: ActivityItem[] = [
  { id: "a1", type: "summary-generated", timestamp: "2026-06-18T16:10:00Z" },
  {
    id: "a2",
    type: "transcript-edited",
    timestamp: "2026-06-18T16:02:00Z",
    description: "Transcript edited by Priya",
  },
  {
    id: "a3",
    type: "processing-completed",
    timestamp: "2026-06-18T15:58:00Z",
  },
  { id: "a4", type: "recording-uploaded", timestamp: "2026-06-18T15:00:00Z" },
];

export const mockTranscriptBlocks: TranscriptBlockData[] = [
  {
    id: "b1",
    timestampSeconds: 0,
    speaker: { id: "s1", name: "Alex Chen" },
    text: "Alright, let's get started. Today we're going over Q3 priorities and the billing revamp timeline.",
  },
  {
    id: "b2",
    timestampSeconds: 12,
    speaker: { id: "s2", name: "Priya Nair" },
    text: "Sounds good. From design's side, the new pricing page mockups will be ready by Friday.",
  },
  {
    id: "b3",
    timestampSeconds: 45,
    speaker: { id: "s1", name: "Alex Chen" },
    text: "Great. Engineering, where are we on the payments migration?",
  },
  {
    id: "b4",
    timestampSeconds: 58,
    speaker: { id: "s3", name: "Sam Torres" },
    text: "There's some risk around the migration timeline. We want to run a spike next week before committing to a date.",
  },
  { id: "b5", timestampSeconds: 90, text: "(cross-talk)" },
  {
    id: "b6",
    timestampSeconds: 105,
    speaker: { id: "s1", name: "Alex Chen" },
    text: "Works for me — let's revisit after the spike. Anything else before we wrap?",
  },
];

export const mockSummaryExecutiveSummary = mockOverviewSummary;

export const mockSummaryTopics: DiscussionTopicData[] = [
  {
    id: "topic-1",
    title: "Q3 priorities",
    description: "Reviewed the roadmap and agreed billing revamp ships first.",
  },
  {
    id: "topic-2",
    title: "Payments migration",
    description:
      "Discussed timeline risk and the need for a spike before committing to a date.",
  },
  { id: "topic-3", title: "Pricing page design" },
];

export const mockSummaryDecisions: DecisionData[] = [
  {
    id: "decision-1",
    text: "Ship the billing revamp before the analytics dashboard",
    timestampSeconds: 252,
  },
  { id: "decision-2", text: "Design finalizes pricing page mockups by Friday" },
  {
    id: "decision-3",
    text: "Engineering runs a migration spike before committing to a date",
    timestampSeconds: 1125,
  },
];

export const mockSummaryActionItems: ActionItemData[] = [
  {
    id: "action-1",
    text: "Finalize new pricing page mockups",
    assignee: { id: "s2", name: "Priya Nair" },
    dueDate: "2026-06-19T00:00:00Z",
    status: "in-progress",
  },
  {
    id: "action-2",
    text: "Run payments migration spike",
    assignee: { id: "s3", name: "Sam Torres" },
    dueDate: "2026-06-25T00:00:00Z",
    status: "not-started",
  },
  {
    id: "action-3",
    text: "Share Q3 roadmap summary with stakeholders",
    assignee: { id: "s1", name: "Alex Chen" },
    status: "completed",
  },
  {
    id: "action-4",
    text: "Confirm legacy invoice export cutover date",
    status: "blocked",
  },
];

export const mockSummaryRisks: RiskData[] = [
  {
    id: "risk-1",
    text: "Payments migration timeline is uncertain until the spike completes",
  },
  {
    id: "risk-2",
    text: "Pricing page mockups may slip if design feedback is delayed",
  },
];

export const mockSummaryOpenQuestions: OpenQuestionData[] = [
  {
    id: "question-1",
    text: "Do we cut the legacy invoice export before or after the migration?",
  },
  {
    id: "question-2",
    text: "Who owns communicating the billing revamp timeline to customers?",
  },
];

export const mockSummaryNextSteps: NextStepData[] = [
  {
    id: "step-1",
    text: "Reconvene after the payments migration spike next week",
  },
  { id: "step-2", text: "Review pricing page mockups in Friday's design sync" },
];

export const mockTimelineEvents: TimelineEventData[] = [
  { id: "event-1", timestampSeconds: 0, title: "Meeting started" },
  {
    id: "event-2",
    timestampSeconds: 252,
    title: "Q3 priorities discussion",
    description:
      "Agreed to ship the billing revamp before the analytics dashboard",
    speaker: "Alex Chen",
  },
  {
    id: "event-3",
    timestampSeconds: 705,
    title: "Pricing page mockups reviewed",
    description: "Design walked through the new pricing page layout",
    speaker: "Priya Nair",
  },
  {
    id: "event-4",
    timestampSeconds: 1125,
    title: "Payments migration risk flagged",
    description:
      "Engineering proposed a spike before committing to a migration date",
    speaker: "Sam Torres",
  },
  { id: "event-5", timestampSeconds: 1640, title: "Meeting wrapped" },
];

export const mockDownloadsExports: ExportCardData[] = [
  {
    format: "pdf",
    fileSizeBytes: 842_000,
    lastGeneratedAt: "2026-06-18T16:12:00Z",
  },
  {
    format: "docx",
    fileSizeBytes: 610_000,
    lastGeneratedAt: "2026-06-18T16:12:00Z",
  },
  { format: "txt" },
  {
    format: "json",
    fileSizeBytes: 128_000,
    lastGeneratedAt: "2026-06-17T09:30:00Z",
  },
];

export const mockDownloadsHistory: ExportHistoryEntry[] = [
  {
    id: "export-1",
    fileName: "q3-roadmap-sync.pdf",
    format: "pdf",
    generatedAt: "2026-06-18T16:12:00Z",
  },
  {
    id: "export-2",
    fileName: "q3-roadmap-sync.docx",
    format: "docx",
    generatedAt: "2026-06-18T16:12:00Z",
  },
  {
    id: "export-3",
    fileName: "q3-roadmap-sync.json",
    format: "json",
    generatedAt: "2026-06-17T09:30:00Z",
  },
];

export const mockInfoPanelParticipants: Participant[] = [
  { id: "s1", name: "Alex Chen", role: "Host" },
  { id: "s2", name: "Priya Nair", role: "Design" },
  { id: "s3", name: "Sam Torres", role: "Engineering" },
];

export const mockInfoPanelTags: MeetingTag[] = [
  { id: "tag-1", label: "Roadmap" },
  { id: "tag-2", label: "Q3" },
  { id: "tag-3", label: "Billing" },
];

export const mockInfoPanelRecording: RecordingInfoData = {
  type: "video",
  durationSeconds: 2745,
  sizeBytes: 68_400_000,
  quality: "High · 48kHz",
};

export const mockInfoPanelProcessing: ProcessingInfoData = {
  processingTimeSeconds: 184,
  transcriptStatus: "completed",
  summaryStatus: "generated",
};
