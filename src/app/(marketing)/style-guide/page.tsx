"use client";

import { useState } from "react";
import { AlertTriangle, Inbox, Layers, Users, Video } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { NewMeetingModal } from "@/components/meetings/new-meeting-modal";
import { MeetingWorkspaceLayout } from "@/components/meetings/workspace/meeting-workspace-layout";
import { WorkspaceHeader } from "@/components/meetings/workspace/workspace-header";
import { WorkspaceNavigation } from "@/components/meetings/workspace/workspace-navigation";
import type { WorkspaceTabValue } from "@/components/meetings/workspace/workspace-tabs";
import { MeetingOverview } from "@/components/meetings/overview/meeting-overview";
import type {
  ActivityItem,
  MeetingMetadataData,
  MeetingStatisticsData,
  RecordingInfo,
  TimelineEventPreview,
} from "@/components/meetings/overview/types";
import { TranscriptViewer } from "@/components/meetings/transcript/transcript-viewer";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";
import { SummaryViewer } from "@/components/meetings/summary/summary-viewer";
import type {
  ActionItemData,
  DecisionData,
  DiscussionTopicData,
  NextStepData,
  OpenQuestionData,
  RiskData,
} from "@/components/meetings/summary/types";
import { TimelineViewer } from "@/components/meetings/timeline/timeline-viewer";
import type { TimelineEventData } from "@/components/meetings/timeline/types";
import { DownloadsPanel } from "@/components/meetings/downloads/downloads-panel";
import type {
  ExportCardData,
  ExportHistoryEntry,
} from "@/components/meetings/downloads/types";
import { MeetingInfoPanel } from "@/components/meetings/info-panel/meeting-info-panel";
import type {
  MeetingTag,
  Participant,
  ProcessingInfoData,
  RecordingInfoData,
} from "@/components/meetings/info-panel/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const invoices = [
  {
    id: "INV-001",
    customer: "Acme Corp",
    status: "success" as const,
    amount: "$1,200.00",
  },
  {
    id: "INV-002",
    customer: "Globex Inc",
    status: "warning" as const,
    amount: "$430.00",
  },
  {
    id: "INV-003",
    customer: "Initech",
    status: "error" as const,
    amount: "$0.00",
  },
  {
    id: "INV-004",
    customer: "Umbrella LLC",
    status: "info" as const,
    amount: "$2,890.00",
  },
];

const statusLabel: Record<(typeof invoices)[number]["status"], string> = {
  success: "Paid",
  warning: "Pending",
  error: "Failed",
  info: "Processing",
};

const overviewMetadata: MeetingMetadataData = {
  title: "Q3 roadmap sync",
  status: "completed",
  durationSeconds: 2745,
  createdAt: "2026-06-18T15:00:00Z",
  updatedAt: "2026-06-18T16:10:00Z",
};

const overviewStatistics: MeetingStatisticsData = {
  transcriptWordCount: 4820,
  processingTimeSeconds: 184,
  summaryStatus: "generated",
  recordingSizeBytes: 68_400_000,
};

const overviewRecording: RecordingInfo = {
  type: "video",
  durationSeconds: 2745,
  audioQuality: "High · 48kHz",
};

const overviewSummary =
  "The team aligned on Q3 priorities, agreeing to ship the billing revamp before the analytics dashboard. " +
  "Design will finalize the new pricing page mockups by Friday. Engineering flagged a risk around the " +
  "payments migration timeline and will report back after a spike next week.";

const overviewTimelineEvents: TimelineEventPreview[] = [
  { id: "t1", label: "Meeting started", timeLabel: "00:00" },
  { id: "t2", label: "Q3 priorities discussion", timeLabel: "04:12" },
  {
    id: "t3",
    label: "Billing revamp scope",
    timeLabel: "18:45",
    description: "Agreed to cut the legacy invoice export",
  },
];

const overviewActivity: ActivityItem[] = [
  {
    id: "a1",
    type: "summary-generated",
    timestamp: "2026-06-18T16:10:00Z",
  },
  {
    id: "a2",
    type: "transcript-edited",
    timestamp: "2026-06-18T16:02:00Z",
    description: "Transcript edited by Priya",
  },
  { id: "a3", type: "processing-completed", timestamp: "2026-06-18T15:58:00Z" },
  { id: "a4", type: "recording-uploaded", timestamp: "2026-06-18T15:00:00Z" },
];

const transcriptBlocks: TranscriptBlockData[] = [
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
  {
    id: "b5",
    timestampSeconds: 90,
    text: "(cross-talk)",
  },
  {
    id: "b6",
    timestampSeconds: 105,
    speaker: { id: "s1", name: "Alex Chen" },
    text: "Works for me — let's revisit after the spike. Anything else before we wrap?",
  },
];

const summaryExecutiveSummary =
  "The team aligned on Q3 priorities, agreeing to ship the billing revamp before the analytics dashboard. " +
  "Design will finalize the new pricing page mockups by Friday. Engineering flagged a risk around the " +
  "payments migration timeline and will report back after a spike next week.";

const summaryTopics: DiscussionTopicData[] = [
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

const summaryDecisions: DecisionData[] = [
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

const summaryActionItems: ActionItemData[] = [
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

const summaryRisks: RiskData[] = [
  {
    id: "risk-1",
    text: "Payments migration timeline is uncertain until the spike completes",
  },
  {
    id: "risk-2",
    text: "Pricing page mockups may slip if design feedback is delayed",
  },
];

const summaryOpenQuestions: OpenQuestionData[] = [
  {
    id: "question-1",
    text: "Do we cut the legacy invoice export before or after the migration?",
  },
  {
    id: "question-2",
    text: "Who owns communicating the billing revamp timeline to customers?",
  },
];

const summaryNextSteps: NextStepData[] = [
  {
    id: "step-1",
    text: "Reconvene after the payments migration spike next week",
  },
  { id: "step-2", text: "Review pricing page mockups in Friday's design sync" },
];

const timelineEvents: TimelineEventData[] = [
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

const downloadsExports: ExportCardData[] = [
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

const downloadsHistory: ExportHistoryEntry[] = [
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

const infoPanelParticipants: Participant[] = [
  { id: "s1", name: "Alex Chen", role: "Host" },
  { id: "s2", name: "Priya Nair", role: "Design" },
  { id: "s3", name: "Sam Torres", role: "Engineering" },
];

const infoPanelTags: MeetingTag[] = [
  { id: "tag-1", label: "Roadmap" },
  { id: "tag-2", label: "Q3" },
  { id: "tag-3", label: "Billing" },
];

const infoPanelRecording: RecordingInfoData = {
  type: "video",
  durationSeconds: 2745,
  sizeBytes: 68_400_000,
  quality: "High · 48kHz",
};

const infoPanelProcessing: ProcessingInfoData = {
  processingTimeSeconds: 184,
  transcriptStatus: "completed",
  summaryStatus: "generated",
};

export default function StyleGuidePage() {
  const [search, setSearch] = useState("");
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] =
    useState<WorkspaceTabValue>("overview");
  const [overviewDemoState, setOverviewDemoState] = useState<
    "data" | "loading" | "empty"
  >("data");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [transcriptEditMode, setTranscriptEditMode] = useState(false);
  const [transcriptDemoState, setTranscriptDemoState] = useState<
    "data" | "loading" | "empty"
  >("data");
  const [editableBlocks, setEditableBlocks] = useState(transcriptBlocks);
  const [summaryDemoState, setSummaryDemoState] = useState<
    "data" | "loading" | "empty"
  >("data");
  const [demoActionItems, setDemoActionItems] = useState(summaryActionItems);
  const [timelineDemoState, setTimelineDemoState] = useState<
    "data" | "loading" | "empty"
  >("data");
  const [timelineSearch, setTimelineSearch] = useState("");
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [downloadsDemoState, setDownloadsDemoState] = useState<
    "data" | "loading" | "empty"
  >("data");
  const [infoPanelDemoState, setInfoPanelDemoState] = useState<
    "data" | "loading" | "empty"
  >("data");

  return (
    <PageContainer className="flex flex-col gap-10 pb-24">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Design System</h1>
        <p className="text-sm text-muted-foreground">
          Reusable primitives for Converra. Minimal, semantic, and consistent
          across light and dark themes.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="New meeting modal"
          description="Entry point for starting a new meeting."
          action={
            <Button size="sm" onClick={() => setNewMeetingOpen(true)}>
              New meeting
            </Button>
          }
        />
        <NewMeetingModal
          open={newMeetingOpen}
          onOpenChange={setNewMeetingOpen}
          onContinue={(data) => {
            setNewMeetingOpen(false);
            toast(
              `Continue: "${data.title || "Untitled meeting"}" via ${data.source}`,
            );
          }}
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Buttons" description="Variants and sizes." />
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button size="sm">Small</Button>
            <Button disabled>Disabled</Button>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Badges & status"
          description="Semantic status indicators."
        />
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Separator orientation="vertical" className="h-5" />
            <StatusBadge status="success">Active</StatusBadge>
            <StatusBadge status="warning">Pending</StatusBadge>
            <StatusBadge status="error">Failed</StatusBadge>
            <StatusBadge status="info">In progress</StatusBadge>
            <StatusBadge status="neutral">Archived</StatusBadge>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Inputs" description="Text input and search." />
        <Card>
          <CardContent className="flex max-w-md flex-col gap-3">
            <Input placeholder="you@company.com" />
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
            />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Progress & skeleton" />
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Progress value={64} />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Table"
          description="Invoice list."
          action={<Button size="sm">New invoice</Button>}
        />
        <Card size="sm">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="pl-4 font-medium">
                      {invoice.id}
                    </TableCell>
                    <TableCell>{invoice.customer}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status}>
                        {statusLabel[invoice.status]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">
                      {invoice.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Cards" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly revenue</CardTitle>
              <CardDescription>Compared to last month</CardDescription>
              <CardAction>
                <Badge variant="secondary">+12%</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">$48,290</p>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">Updated just now</p>
            </CardFooter>
          </Card>

          <Card>
            <CardContent>
              <EmptyState
                icon={<Inbox />}
                title="No messages yet"
                description="When you receive messages, they'll show up here."
                action={<Button size="sm">Compose</Button>}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Meeting workspace shell"
          description="Permanent layout for a single meeting: header, tab navigation, scrollable content, and a sticky info rail. Scroll inside the frame to see the tab bar stick."
        />
        <div className="h-[560px] overflow-y-auto rounded-xl ring-1 ring-foreground/10">
          <MeetingWorkspaceLayout
            header={
              <WorkspaceHeader
                title="Q3 roadmap sync"
                titleAs="h2"
                status="completed"
                durationSeconds={2745}
                createdAt="2026-06-18T15:00:00Z"
              />
            }
            navigation={
              <WorkspaceNavigation
                value={workspaceTab}
                onValueChange={setWorkspaceTab}
              />
            }
            activeTab={workspaceTab}
          >
            <div className="flex flex-col gap-4 py-6">
              <EmptyState
                title={`"${workspaceTab}" tab content renders here`}
                description="Owned by whichever page uses this shell — the layout itself stays content-agnostic."
              />
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          </MeetingWorkspaceLayout>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Meeting overview"
          description="Overview tab of the meeting workspace. Presentational only — every section renders from props and supports its own loading/empty state."
          action={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={overviewDemoState === "data" ? "secondary" : "outline"}
                onClick={() => setOverviewDemoState("data")}
              >
                Data
              </Button>
              <Button
                size="sm"
                variant={
                  overviewDemoState === "loading" ? "secondary" : "outline"
                }
                onClick={() => setOverviewDemoState("loading")}
              >
                Loading
              </Button>
              <Button
                size="sm"
                variant={
                  overviewDemoState === "empty" ? "secondary" : "outline"
                }
                onClick={() => setOverviewDemoState("empty")}
              >
                Empty
              </Button>
            </div>
          }
        />
        <MeetingOverview
          loading={overviewDemoState === "loading"}
          metadata={overviewDemoState === "data" ? overviewMetadata : undefined}
          statistics={
            overviewDemoState === "data" ? overviewStatistics : undefined
          }
          recording={
            overviewDemoState === "data" ? overviewRecording : undefined
          }
          summary={overviewDemoState === "data" ? overviewSummary : undefined}
          timelineEvents={
            overviewDemoState === "data" ? overviewTimelineEvents : undefined
          }
          activity={overviewDemoState === "data" ? overviewActivity : undefined}
          onViewFullSummary={() => toast("View full summary")}
          onViewTimeline={() => toast("View timeline")}
          onDownloadRecording={() => toast("Download recording")}
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Transcript viewer"
          description="Search highlighting, clickable timestamps, and a controlled edit mode. No API, no generated text — everything renders from the blocks passed in."
          action={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={
                  transcriptDemoState === "data" ? "secondary" : "outline"
                }
                onClick={() => setTranscriptDemoState("data")}
              >
                Data
              </Button>
              <Button
                size="sm"
                variant={
                  transcriptDemoState === "loading" ? "secondary" : "outline"
                }
                onClick={() => setTranscriptDemoState("loading")}
              >
                Loading
              </Button>
              <Button
                size="sm"
                variant={
                  transcriptDemoState === "empty" ? "secondary" : "outline"
                }
                onClick={() => setTranscriptDemoState("empty")}
              >
                Empty
              </Button>
            </div>
          }
        />
        <TranscriptViewer
          blocks={transcriptDemoState === "data" ? editableBlocks : []}
          isLoading={transcriptDemoState === "loading"}
          searchValue={transcriptSearch}
          onSearchChange={setTranscriptSearch}
          editMode={transcriptEditMode}
          onEditModeChange={setTranscriptEditMode}
          onBlockTextChange={(blockId, text) =>
            setEditableBlocks((blocks) =>
              blocks.map((block) =>
                block.id === blockId ? { ...block, text } : block,
              ),
            )
          }
          onTimestampClick={(seconds) => toast(`Jump to ${seconds}s`)}
          onCopy={() => toast("Transcript copied")}
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Summary viewer"
          description="Executive summary, discussion topics, decisions, action items, risks, open questions, and next steps. Presentational only — every section renders from props and manages its own empty/loading state."
          action={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={summaryDemoState === "data" ? "secondary" : "outline"}
                onClick={() => setSummaryDemoState("data")}
              >
                Data
              </Button>
              <Button
                size="sm"
                variant={
                  summaryDemoState === "loading" ? "secondary" : "outline"
                }
                onClick={() => setSummaryDemoState("loading")}
              >
                Loading
              </Button>
              <Button
                size="sm"
                variant={summaryDemoState === "empty" ? "secondary" : "outline"}
                onClick={() => setSummaryDemoState("empty")}
              >
                Empty
              </Button>
            </div>
          }
        />
        <SummaryViewer
          loading={summaryDemoState === "loading"}
          executiveSummary={
            summaryDemoState === "data" ? summaryExecutiveSummary : undefined
          }
          topics={summaryDemoState === "data" ? summaryTopics : undefined}
          decisions={summaryDemoState === "data" ? summaryDecisions : undefined}
          actionItems={
            summaryDemoState === "data" ? demoActionItems : undefined
          }
          risks={summaryDemoState === "data" ? summaryRisks : undefined}
          openQuestions={
            summaryDemoState === "data" ? summaryOpenQuestions : undefined
          }
          nextSteps={summaryDemoState === "data" ? summaryNextSteps : undefined}
          onToggleActionItem={(id) =>
            setDemoActionItems((items) =>
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
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Timeline viewer"
          description="Search highlighting, event count, and an expand/collapse placeholder over a vertical list of key moments. Callback only — no transcript seeking."
          action={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={timelineDemoState === "data" ? "secondary" : "outline"}
                onClick={() => setTimelineDemoState("data")}
              >
                Data
              </Button>
              <Button
                size="sm"
                variant={
                  timelineDemoState === "loading" ? "secondary" : "outline"
                }
                onClick={() => setTimelineDemoState("loading")}
              >
                Loading
              </Button>
              <Button
                size="sm"
                variant={
                  timelineDemoState === "empty" ? "secondary" : "outline"
                }
                onClick={() => setTimelineDemoState("empty")}
              >
                Empty
              </Button>
            </div>
          }
        />
        <TimelineViewer
          events={timelineDemoState === "data" ? timelineEvents : []}
          isLoading={timelineDemoState === "loading"}
          searchValue={timelineSearch}
          onSearchChange={setTimelineSearch}
          expanded={timelineExpanded}
          onExpandedChange={setTimelineExpanded}
          onItemClick={(event) => toast(`Jump to "${event.title}"`)}
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Downloads & export center"
          description="Per-format export cards and a history of previously generated files. Presentational only — no export logic, no API, no file generation."
          action={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={downloadsDemoState === "data" ? "secondary" : "outline"}
                onClick={() => setDownloadsDemoState("data")}
              >
                Data
              </Button>
              <Button
                size="sm"
                variant={
                  downloadsDemoState === "loading" ? "secondary" : "outline"
                }
                onClick={() => setDownloadsDemoState("loading")}
              >
                Loading
              </Button>
              <Button
                size="sm"
                variant={
                  downloadsDemoState === "empty" ? "secondary" : "outline"
                }
                onClick={() => setDownloadsDemoState("empty")}
              >
                Empty
              </Button>
            </div>
          }
        />
        <DownloadsPanel
          loading={downloadsDemoState === "loading"}
          exports={downloadsDemoState === "data" ? downloadsExports : undefined}
          history={downloadsDemoState === "data" ? downloadsHistory : undefined}
          onDownload={(format) => toast(`Download ${format.toUpperCase()}`)}
          onRegenerate={(format) => toast(`Regenerate ${format.toUpperCase()}`)}
          onDownloadHistoryEntry={(entry) => toast(`Download ${entry.fileName}`)}
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Meeting info panel"
          description="Right-side info rail for the meeting workspace: participants, tags, recording details, processing status, and an AI insights placeholder."
          action={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={infoPanelDemoState === "data" ? "secondary" : "outline"}
                onClick={() => setInfoPanelDemoState("data")}
              >
                Data
              </Button>
              <Button
                size="sm"
                variant={
                  infoPanelDemoState === "loading" ? "secondary" : "outline"
                }
                onClick={() => setInfoPanelDemoState("loading")}
              >
                Loading
              </Button>
              <Button
                size="sm"
                variant={
                  infoPanelDemoState === "empty" ? "secondary" : "outline"
                }
                onClick={() => setInfoPanelDemoState("empty")}
              >
                Empty
              </Button>
            </div>
          }
        />
        <div className="max-w-sm">
          <MeetingInfoPanel
            loading={infoPanelDemoState === "loading"}
            participants={
              infoPanelDemoState === "data" ? infoPanelParticipants : undefined
            }
            tags={infoPanelDemoState === "data" ? infoPanelTags : undefined}
            recording={
              infoPanelDemoState === "data" ? infoPanelRecording : undefined
            }
            processing={
              infoPanelDemoState === "data" ? infoPanelProcessing : undefined
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Statistics cards"
          description="Reusable metric tiles with optional icon, trend, status color, and loading state."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total meetings"
            value="1,284"
            icon={Video}
            trend={{ direction: "up", value: "12%", label: "vs last month" }}
            description="Across all workspaces"
          />
          <StatCard
            title="Failed transcriptions"
            value="6"
            icon={AlertTriangle}
            status="error"
            trend={{ direction: "down", value: "3%", label: "vs last week" }}
          />
          <StatCard
            title="Storage used"
            value="82%"
            icon={Layers}
            status="warning"
            description="Approaching plan limit"
          />
          <StatCard title="Team members" icon={Users} loading />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Toast" description="Transient feedback." />
        <Card>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast("Changes saved")}>
              Default
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.success("Invoice paid")}
            >
              Success
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.warning("Payment pending")}
            >
              Warning
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.error("Payment failed")}
            >
              Error
            </Button>
          </CardContent>
        </Card>
      </section>
    </PageContainer>
  );
}
