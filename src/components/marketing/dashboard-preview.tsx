import { CheckCircle2, Loader2, Video } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type PreviewMeeting = {
  title: string;
  duration: string;
  status: "success" | "info";
  statusLabel: string;
};

const previewMeetings: PreviewMeeting[] = [
  {
    title: "Q3 roadmap planning",
    duration: "42 min",
    status: "success",
    statusLabel: "Summarized",
  },
  {
    title: "Customer discovery call",
    duration: "28 min",
    status: "success",
    statusLabel: "Summarized",
  },
  {
    title: "Weekly design sync",
    duration: "16 min",
    status: "info",
    statusLabel: "Transcribing",
  },
];

function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border/60 bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </div>
        <div className="flex h-6 flex-1 items-center rounded-md bg-background/80 px-3 text-xs text-muted-foreground ring-1 ring-foreground/5">
          app.converra.com/dashboard
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">Welcome back</p>
          <p className="text-xs text-muted-foreground">
            Here&apos;s what happened across your meetings this week.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard title="Total meetings" value={128} icon={Video} />
          <StatCard
            title="Processing"
            value={2}
            icon={Loader2}
            status="info"
          />
          <StatCard
            title="Completed"
            value={126}
            icon={CheckCircle2}
            status="success"
          />
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-2 ring-1 ring-foreground/5">
          {previewMeetings.map((meeting) => (
            <div
              key={meeting.title}
              className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2.5 ring-1 ring-foreground/5"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-sm font-medium text-foreground">
                  {meeting.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {meeting.duration}
                </p>
              </div>
              <StatusBadge status={meeting.status} className="shrink-0">
                {meeting.statusLabel}
              </StatusBadge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { DashboardPreview };
