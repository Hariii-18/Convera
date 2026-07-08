import * as React from "react";
import { ExternalLink, FileAudio, FileVideo, Trash2, UploadCloud } from "lucide-react";

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
import { TranscriptStatusBadge } from "@/components/uploads/transcript-status-badge";
import { getTranscriptStatus } from "@/components/uploads/transcript-status";
import { formatRelativeTime } from "@/components/meetings/format";
import type { Meeting } from "@/components/meetings/types";
import type { Upload } from "@/features/uploads/mappers";

const VIDEO_MIME_PREFIX = "video/";

type RecentUploadsListProps = {
  uploads: Upload[];
  /** Meeting each upload belongs to, keyed by meeting id, for the meeting-oriented columns. */
  meetingsById?: Map<string, Meeting>;
  isLoading?: boolean;
  onView?: (upload: Upload) => void;
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
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          <Skeleton className="size-7 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Meeting-oriented table of previously uploaded recordings: each row shows
 * the linked meeting, upload status, and transcript status alongside file
 * actions. Purely presentational — it never fetches or deletes anything
 * itself, only renders whatever is passed and reports intents to the caller.
 */
function RecentUploadsList({
  uploads,
  meetingsById,
  isLoading = false,
  onView,
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
          <TableHead>Meeting</TableHead>
          <TableHead className="w-px whitespace-nowrap">Upload status</TableHead>
          <TableHead className="w-px whitespace-nowrap">Transcript status</TableHead>
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
          const meeting = upload.meetingId
            ? meetingsById?.get(upload.meetingId)
            : undefined;
          const canView = Boolean(upload.meetingId && onView);

          return (
            <TableRow
              key={upload.id}
              data-slot="upload-row"
              className={canView ? "cursor-pointer" : undefined}
              onClick={canView ? () => onView?.(upload) : undefined}
            >
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
              <TableCell className="max-w-48 truncate text-muted-foreground">
                {meeting ? meeting.title : upload.meetingId ? "—" : "Not linked"}
              </TableCell>
              <TableCell className="w-px whitespace-nowrap">
                <UploadStatusBadge status={upload.status} />
              </TableCell>
              <TableCell className="w-px whitespace-nowrap">
                <TranscriptStatusBadge status={getTranscriptStatus(meeting)} />
              </TableCell>
              <TableCell className="w-px whitespace-nowrap text-muted-foreground">
                {formatRelativeTime(upload.createdAt)}
              </TableCell>
              <TableCell
                className="w-px whitespace-nowrap pr-4"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Open meeting for ${upload.originalFilename}`}
                    onClick={() => onView?.(upload)}
                    disabled={!canView}
                  >
                    <ExternalLink />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${upload.originalFilename}`}
                    onClick={() => onDelete?.(upload)}
                    disabled={!onDelete}
                  >
                    <Trash2 />
                  </Button>
                </div>
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
