import { Skeleton } from "@/components/ui/skeleton";

function ProcessingItemSkeleton() {
  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
    </li>
  );
}

/** Standalone queue-shaped loading state, reusable as a Suspense/route fallback. */
function ProcessingQueueSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul
      role="list"
      aria-hidden="true"
      className="flex flex-col divide-y divide-border"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProcessingItemSkeleton key={index} />
      ))}
    </ul>
  );
}

export { ProcessingItemSkeleton, ProcessingQueueSkeleton };
