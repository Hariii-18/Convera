import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { MeetingsTableHeader } from "@/components/meetings/meeting-table-header";

function MeetingRowSkeleton() {
  return (
    <TableRow className="hover:bg-transparent" aria-hidden="true">
      <TableCell className="py-3 pl-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </TableCell>
      <TableCell className="w-px whitespace-nowrap">
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell className="w-px whitespace-nowrap">
        <Skeleton className="h-4 w-10" />
      </TableCell>
      <TableCell className="w-px whitespace-nowrap">
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className="w-px whitespace-nowrap">
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className="w-px whitespace-nowrap pr-4">
        <Skeleton className="size-7 rounded-md" />
      </TableCell>
    </TableRow>
  );
}

/** Standalone table-shaped loading state, reusable as a Suspense/route fallback. */
function MeetingsTableSkeleton({ rowCount = 5 }: { rowCount?: number }) {
  return (
    <Table>
      <MeetingsTableHeader />
      <TableBody>
        {Array.from({ length: rowCount }).map((_, index) => (
          <MeetingRowSkeleton key={index} />
        ))}
      </TableBody>
    </Table>
  );
}

export { MeetingRowSkeleton, MeetingsTableSkeleton };
