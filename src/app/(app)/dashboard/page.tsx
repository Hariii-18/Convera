"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarPlus,
  CheckCircle2,
  FolderOpen,
  Layers,
  MonitorPlay,
  Upload,
  Video,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WelcomeSection } from "@/components/dashboard/welcome-section";
import {
  QuickActions,
  type QuickAction,
} from "@/components/dashboard/quick-actions";
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
import { formatBytes } from "@/components/meetings/format";
import { extractErrorMessage } from "@/features/auth/error";
import { useCreateMeeting } from "@/features/meetings/hooks/use-create-meeting";
import { useDeleteMeeting } from "@/features/meetings/hooks/use-delete-meeting";
import { useUpdateMeeting } from "@/features/meetings/hooks/use-update-meeting";
import { useMeetings } from "@/features/meetings/hooks/use-meetings";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";
import { RenameMeetingDialog } from "@/components/meetings/rename-meeting-dialog";
import { DeleteMeetingDialog } from "@/components/meetings/delete-meeting-dialog";
import { GuestUpgradeDialog } from "@/components/guest/guest-upgrade-dialog";
import { useGuestGate } from "@/features/guest/use-guest-gate";
import { useGuestMeetingsStore } from "@/features/guest/guest-meetings-store";

export default function DashboardPage() {
  const router = useRouter();
  const { isGuest, pendingAction, guard, closeDialog } = useGuestGate();
  const guestMeetings = useGuestMeetingsStore((state) => state.meetings);
  const addGuestMeeting = useGuestMeetingsStore((state) => state.addMeeting);

  const { data: fetchedMeetings, isLoading } = useMeetings({
    enabled: !isGuest,
  });
  const meetings = isGuest ? guestMeetings : fetchedMeetings;
  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
  } = useDashboardStats({ enabled: !isGuest });
  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Meeting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);
  const updateMeeting = useUpdateMeeting(renameTarget?.id ?? "");

  const statsUnavailable = isStatsError || isGuest;
  const dashboardStats: StatItem[] = [
    {
      title: "Total meetings",
      icon: Video,
      value: statsUnavailable ? "—" : stats?.totalMeetings,
      loading: isStatsLoading,
    },
    {
      title: "Processing",
      icon: Activity,
      value: statsUnavailable ? "—" : stats?.processingMeetings,
      loading: isStatsLoading,
    },
    {
      title: "Completed",
      icon: CheckCircle2,
      value: statsUnavailable ? "—" : stats?.completedMeetings,
      loading: isStatsLoading,
    },
    {
      title: "Failed",
      icon: XCircle,
      value: statsUnavailable ? "—" : stats?.failedMeetings,
      loading: isStatsLoading,
    },
    {
      title: "Storage used",
      icon: Layers,
      value: statsUnavailable ? "—" : formatBytes(stats?.storageUsedBytes),
      loading: isStatsLoading,
    },
  ];

  function handleView(meeting: Meeting) {
    router.push(`/meetings/${meeting.id}`);
  }

  function handleContinue(data: { title: string; source: MeetingSourceId }) {
    if (isGuest) {
      const now = new Date().toISOString();
      const meeting: Meeting = {
        id: crypto.randomUUID(),
        title: data.title || "Untitled meeting",
        status: "scheduled",
        durationSeconds: null,
        createdAt: now,
        updatedAt: now,
      };
      addGuestMeeting(meeting);
      setNewMeetingOpen(false);
      router.push(`/meetings/${meeting.id}`);
      return;
    }

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

  function handleRenameConfirm(title: string) {
    if (!renameTarget) return;
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
      },
      onError: (mutationError) => {
        toast.error(extractErrorMessage(mutationError));
      },
    });
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
      onClick: () => router.push("/uploads"),
    },
    {
      id: "live-browser-meeting",
      title: "Live Browser Meeting",
      description: "Capture a meeting straight from your browser",
      icon: MonitorPlay,
      badge: { label: "Live", variant: "secondary" },
      onClick: () => guard("live-meeting", () => router.push("/live")),
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
            isLoading={isGuest ? false : isLoading}
            onViewMeeting={handleView}
            onRenameMeeting={(meeting) =>
              guard("rename-meeting", () => setRenameTarget(meeting))
            }
            onDownloadMeeting={(meeting) =>
              toast(`Download "${meeting.title}"`)
            }
            onDeleteMeeting={(meeting) =>
              guard("delete-meeting", () => setDeleteTarget(meeting))
            }
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
    </PageContainer>
  );
}
