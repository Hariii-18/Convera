import { Skeleton } from "@/components/ui/skeleton";

function TimelineItemSkeleton({ isLast = false }: { isLast?: boolean }) {
  return (
    <div className="flex gap-3 px-4">
      <div className="flex w-4 shrink-0 flex-col items-center self-stretch">
        <Skeleton className="mt-1.5 size-2.5 shrink-0 rounded-full" />
        {!isLast && <Skeleton className="mt-1.5 w-px flex-1" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-3">
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
    </div>
  );
}

/** Standalone timeline-shaped loading state, reusable as a Suspense/route fallback. */
function TimelineSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {Array.from({ length: count }).map((_, index) => (
        <TimelineItemSkeleton key={index} isLast={index === count - 1} />
      ))}
    </div>
  );
}

export { TimelineItemSkeleton, TimelineSkeleton };
