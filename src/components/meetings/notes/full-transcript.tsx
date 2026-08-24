import * as React from "react";
import { FileText } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FullTranscriptProps = React.ComponentProps<"div"> & {
  transcript?: string;
  loading?: boolean;
  onCopy?: () => void;
};

/**
 * The full transcript text underlying this meeting's notes, verbatim — the
 * normalized transcript when one exists, otherwise the raw transcript
 * (same precedence the Transcript tab uses). Rendered as one contiguous
 * block rather than per-line, distinct from Detailed Discussion above.
 */
function FullTranscript({
  className,
  transcript,
  loading = false,
  onCopy,
  ...props
}: FullTranscriptProps) {
  return (
    <Card data-slot="full-transcript" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Full Transcript</CardTitle>
        {transcript && (
          <CardAction>
            <CopyButton text={transcript} label="Copy Transcript" onCopy={onCopy} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        ) : !transcript ? (
          <EmptyState
            icon={<FileText />}
            title="No transcript yet"
            description="Once this meeting is transcribed, the full transcript will appear here."
          />
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {transcript}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { FullTranscript };
export type { FullTranscriptProps };
