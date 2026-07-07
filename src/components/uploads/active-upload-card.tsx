import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileAudio,
  FileVideo,
  RotateCcw,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProcessingProgress } from "@/components/processing/processing-progress";
import { formatBytes } from "@/components/meetings/format";
import { cn } from "@/lib/utils";

type ActiveUploadStatus = "uploading" | "success" | "error";

type ActiveUploadCardProps = {
  file: File;
  status: ActiveUploadStatus;
  progress: number;
  errorMessage?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  onRemove?: () => void;
};

const isVideoFile = (file: File) => file.type.startsWith("video/");

/**
 * Presents the single in-flight upload's lifecycle: progress while
 * uploading, then a success or error state with the relevant follow-up
 * actions. Only one of these is ever rendered at a time (single-upload flow).
 */
function ActiveUploadCard({
  file,
  status,
  progress,
  errorMessage,
  onCancel,
  onRetry,
  onRemove,
}: ActiveUploadCardProps) {
  const Icon = isVideoFile(file) ? FileVideo : FileAudio;

  return (
    <Card data-slot="active-upload-card">
      <CardContent className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            status === "error"
              ? "bg-destructive/10 text-destructive"
              : status === "success"
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground",
          )}
        >
          {status === "success" ? (
            <CheckCircle2 className="size-4" />
          ) : status === "error" ? (
            <AlertCircle className="size-4" />
          ) : (
            <Icon className="size-4" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {file.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </span>
          </div>

          {status === "uploading" && (
            <ProcessingProgress percentage={progress} label="Upload" />
          )}

          {status === "success" && (
            <p className="text-xs text-success">Upload complete</p>
          )}

          {status === "error" && (
            <p className="text-xs text-destructive">
              {errorMessage ?? "Upload failed. Please try again."}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {status === "uploading" && onCancel && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel upload"
              onClick={onCancel}
            >
              <X />
            </Button>
          )}
          {status === "error" && onRetry && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Retry upload"
              onClick={onRetry}
            >
              <RotateCcw />
            </Button>
          )}
          {status !== "uploading" && onRemove && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove upload"
              onClick={onRemove}
            >
              <X />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { ActiveUploadCard };
export type { ActiveUploadCardProps, ActiveUploadStatus };
