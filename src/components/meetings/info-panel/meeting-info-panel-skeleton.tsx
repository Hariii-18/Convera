import { Skeleton } from "@/components/ui/skeleton";

function InfoCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Standalone info-rail-shaped loading state, reusable as a Suspense/route fallback. */
function MeetingInfoPanelSkeleton() {
  return (
    <div role="list" aria-hidden="true" className="flex flex-col gap-4">
      <InfoCardSkeleton rows={3} />
      <InfoCardSkeleton rows={1} />
      <InfoCardSkeleton rows={3} />
      <InfoCardSkeleton rows={2} />
    </div>
  );
}

export { InfoCardSkeleton, MeetingInfoPanelSkeleton };
