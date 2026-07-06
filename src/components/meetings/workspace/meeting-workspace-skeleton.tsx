import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingInfoPanelSkeleton } from "@/components/meetings/info-panel/meeting-info-panel-skeleton";

/** Standalone workspace-shaped loading state, shown while a meeting is fetched. */
function MeetingWorkspaceSkeleton() {
  return (
    <div
      data-slot="meeting-workspace-skeleton"
      role="status"
      aria-label="Loading meeting"
      className="flex flex-1 flex-col"
    >
      <div className="w-full border-b border-border">
        <PageContainer size="wide" className="flex flex-col gap-3 py-6">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-32" />
          </div>
        </PageContainer>
      </div>

      <div className="w-full border-b border-border">
        <PageContainer size="wide" className="py-0">
          <div className="flex gap-6 py-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-6 w-20" />
            ))}
          </div>
        </PageContainer>
      </div>

      <PageContainer
        size="wide"
        className="grid flex-1 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>

        <aside className="hidden flex-col gap-4 xl:flex">
          <MeetingInfoPanelSkeleton />
        </aside>
      </PageContainer>
    </div>
  );
}

export { MeetingWorkspaceSkeleton };
