import { Activity, CalendarPlus, Layers, Users, Video } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WelcomeSection } from "@/components/dashboard/welcome-section";
import { QuickActions } from "@/components/dashboard/quick-actions";
import {
  StatisticsGrid,
  type StatItem,
} from "@/components/dashboard/statistics-grid";
import { RecentMeetingsSection } from "@/components/dashboard/recent-meetings-section";
import { ProcessingSection } from "@/components/dashboard/processing-section";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

/** Metrics to surface on the dashboard. Values stay unset until wired to real data. */
const dashboardStats: StatItem[] = [
  { title: "Total meetings", icon: Video },
  { title: "Processing", icon: Activity },
  { title: "Team members", icon: Users },
  { title: "Storage used", icon: Layers },
];

export default function DashboardPage() {
  return (
    <PageContainer size="wide" className="flex flex-col gap-8">
      <DashboardHeader
        title="Dashboard"
        actions={
          <Button size="sm">
            <CalendarPlus data-icon="inline-start" />
            New meeting
          </Button>
        }
      />

      <WelcomeSection />

      <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          <QuickActions />
          <StatisticsGrid stats={dashboardStats} />
          <RecentMeetingsSection />
          <ProcessingSection />
        </div>

        <DashboardSidebar />
      </div>
    </PageContainer>
  );
}
