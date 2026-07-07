import * as React from "react";
import { FileAudio, FileVideo, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadStatusBadge } from "@/components/uploads/upload-status-badge";
import { formatBytes, formatRelativeTime } from "@/components/meetings/format";
import type { Upload } from "@/features/uploads/mappers";

const VIDEO_MIME_PREFIX = "video/";

type RecentUploadsListProps = {
  uploads: Upload[];
  isLoading?: boolean;
  onDelete?: (upload: Upload) => void;
};

function RecentUploadsListSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-2">
      <span role="status" className="sr-only">
        Loading recent uploads&hellip;
      </span>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3" aria-hidden="true">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          <Skeleton className="size-7 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Table of previously uploaded recordings. Purely presentational — it never
 * fetches or deletes anything itself, only renders whatever `uploads` is
 * passed and reports the delete intent back to the caller.
 */
function RecentUploadsList({
  uploads,
  isLoading = false,
  onDelete,
}: RecentUploadsListProps) {
  if (isLoading) {
    return <RecentUploadsListSkeleton />;
  }

  if (uploads.length === 0) {
    return (
      <EmptyState
        icon={<UploadCloud />}
        title="No uploads yet"
        description="Recordings you upload will show up here."
        className="mx-4"
      />
    );
  }

  return (
    <Table aria-label="Recent uploads">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">File</TableHead>
          <TableHead className="w-px whitespace-nowrap">Size</TableHead>
          <TableHead className="w-px whitespace-nowrap">Status</TableHead>
          <TableHead className="w-px whitespace-nowrap">Uploaded</TableHead>
          <TableHead className="w-px whitespace-nowrap pr-4">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {uploads.map((upload) => {
          const Icon = upload.mimeType.startsWith(VIDEO_MIME_PREFIX)
            ? FileVideo
            : FileAudio;

          return (
            <TableRow key={upload.id}>
              <TableCell className="py-3 pl-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  >
                    <Icon className="size-4" />
                  </div>
                  <span className="truncate text-sm font-medium text-foreground">
                    {upload.originalFilename}
                  </span>
                </div>
              </TableCell>
              <TableCell className="w-px whitespace-nowrap text-muted-foreground">
                {formatBytes(upload.sizeBytes)}
              </TableCell>
              <TableCell className="w-px whitespace-nowrap">
                <UploadStatusBadge status={upload.status} />
              </TableCell>
              <TableCell className="w-px whitespace-nowrap text-muted-foreground">
                {formatRelativeTime(upload.createdAt)}
              </TableCell>
              <TableCell className="w-px whitespace-nowrap pr-4">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${upload.originalFilename}`}
                  onClick={() => onDelete?.(upload)}
                  disabled={!onDelete}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export { RecentUploadsList };
export type { RecentUploadsListProps };
