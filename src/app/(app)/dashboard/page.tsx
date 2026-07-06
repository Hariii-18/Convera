"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarPlus,
  FolderOpen,
  Layers,
  MonitorPlay,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WelcomeSection } from "@/components/dashboard/welcome-section";
import { QuickActions, type QuickAction } from "@/components/dashboard/quick-actions";
import {
  StatisticsGrid,
  type StatItem,
} from "@/components/dashboard/statistics-grid";
import { RecentMeetingsSection } from "@/components/dashboard/recent-meetings-section";
import { ProcessingSection } from "@/components/dashboard/processing-section";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { NewMeetingModal } from "@/components/meetings/new-meeting-modal";
import type { MeetingSourceId } from "@/components/meetings/meeting-source";
import type { Meeting } from "@/components/meetings/types";
import { extractErrorMessage } from "@/features/auth/error";
import { useCreateMeeting } from "@/features/meetings/hooks/use-create-meeting";
import { useMeetings } from "@/features/meetings/hooks/use-meetings";

/** Metrics to surface on the dashboard. Values stay unset until wired to real data. */
const dashboardStats: StatItem[] = [
  { title: "Total meetings", icon: Video },
  { title: "Processing", icon: Activity },
  { title: "Team members", icon: Users },
  { title: "Storage used", icon: Layers },
];

export default function DashboardPage() {
  const router = useRouter();
  const { data: meetings, isLoading } = useMeetings();
  const createMeeting = useCreateMeeting();
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);

  function handleView(meeting: Meeting) {
    router.push(`/meetings/${meeting.id}`);
  }

  function handleContinue(data: { title: string; source: MeetingSourceId }) {
    createMeeting.mutate(
      { title: data.title, source_type: data.source },
      {
        onSuccess: (meeting) => {
          setNewMeetingOpen(false);
          router.push(`/meetings/${meeting.id}`);
        },
        onError: (mutationError) => {
          toast.error(extractErrorMessage(mutationError));
        },
      },
    );
  }

  const quickActions: QuickAction[] = [
    {
      id: "new-meeting",
      title: "New Meeting",
      description: "Schedule and record a session",
      icon: CalendarPlus,
      onClick: () => setNewMeetingOpen(true),
    },
    {
      id: "upload-recording",
      title: "Upload Recording",
      description: "Add an existing audio or video file",
      icon: Upload,
      onClick: () => toast("Upload recording"),
    },
    {
      id: "live-browser-meeting",
      title: "Live Browser Meeting",
      description: "Capture a meeting straight from your browser",
      icon: MonitorPlay,
      badge: { label: "Live", variant: "secondary" },
      onClick: () => toast("Live browser meeting"),
    },
    {
      id: "browse-meetings",
      title: "Browse Meetings",
      description: "Explore your recorded and processed sessions",
      icon: FolderOpen,
      onClick: () => router.push("/meetings"),
    },
  ];

  return (
    <PageContainer size="wide" className="flex flex-col gap-8">
      <DashboardHeader
        title="Dashboard"
        actions={
          <Button size="sm" onClick={() => setNewMeetingOpen(true)}>
            <CalendarPlus data-icon="inline-start" />
            New meeting
          </Button>
        }
      />

      <WelcomeSection />

      <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          <QuickActions actions={quickActions} />
          <StatisticsGrid stats={dashboardStats} />
          <RecentMeetingsSection
            meetings={meetings?.slice(0, 5)}
            isLoading={isLoading}
            onViewMeeting={handleView}
            onRenameMeeting={(meeting) => toast(`Rename "${meeting.title}"`)}
            onDownloadMeeting={(meeting) =>
              toast(`Download "${meeting.title}"`)
            }
            onDeleteMeeting={(meeting) => toast(`Delete "${meeting.title}"`)}
            onViewAll={() => router.push("/meetings")}
          />
          <ProcessingSection />
        </div>

        <DashboardSidebar />
      </div>

      <NewMeetingModal
        open={newMeetingOpen}
        onOpenChange={setNewMeetingOpen}
        onContinue={handleContinue}
      />
    </PageContainer>
  );
}
