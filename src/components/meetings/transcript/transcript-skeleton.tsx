import { Skeleton } from "@/components/ui/skeleton";

function TranscriptBlockSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <Skeleton className="mt-0.5 h-3.5 w-10 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

/** Standalone transcript-shaped loading state, reusable as a Suspense/route fallback. */
function TranscriptSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col divide-y divide-border">
      {Array.from({ length: count }).map((_, index) => (
        <TranscriptBlockSkeleton key={index} />
      ))}
    </div>
  );
}

export { TranscriptBlockSkeleton, TranscriptSkeleton };
