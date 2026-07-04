import { Skeleton } from "@/components/ui/skeleton";

function ExportCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

/** Standalone downloads-shaped loading state, reusable as a Suspense/route fallback. */
function DownloadsPanelSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      role="list"
      aria-hidden="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ExportCardSkeleton key={index} />
      ))}
    </div>
  );
}

export { ExportCardSkeleton, DownloadsPanelSkeleton };
