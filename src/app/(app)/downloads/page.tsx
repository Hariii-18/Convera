"use client";

import { useMemo } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportHistory } from "@/components/meetings/downloads/export-history";
import type { ExportHistoryEntry } from "@/components/meetings/downloads/types";
import { extractErrorMessage } from "@/features/auth/error";
import { useMeetings } from "@/features/meetings/hooks/use-meetings";
import { useDownloadTranscript } from "@/features/transcripts/hooks/use-download-transcript";
import type { TranscriptDownloadFormat } from "@/features/transcripts/download";

function parseEntryId(id: string): { meetingId: string; format: TranscriptDownloadFormat } {
  const [meetingId, format] = id.split(":") as [string, TranscriptDownloadFormat];
  return { meetingId, format };
}

export default function DownloadsPage() {
  const { data: meetings, isLoading, isError, error, refetch } = useMeetings();
  const downloadTranscript = useDownloadTranscript();

  const entries: ExportHistoryEntry[] = useMemo(() => {
    const completed = (meetings ?? [])
      .filter((meeting) => meeting.status === "completed")
      .sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    return completed.flatMap((meeting) => [
      {
        id: `${meeting.id}:txt`,
        fileName: `${meeting.title}.txt`,
        format: "txt" as const,
        generatedAt: meeting.updatedAt,
      },
      {
        id: `${meeting.id}:json`,
        fileName: `${meeting.title}.json`,
        format: "json" as const,
        generatedAt: meeting.updatedAt,
      },
    ]);
  }, [meetings]);

  function handleDownload(entry: ExportHistoryEntry) {
    const { meetingId, format } = parseEntryId(entry.id);
    downloadTranscript.mutate(
      { meetingId, format, fileName: entry.fileName },
      {
        onSuccess: () => toast.success(`Downloaded "${entry.fileName}"`),
        onError: (mutationError) => toast.error(extractErrorMessage(mutationError)),
      },
    );
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Downloads"
        description="Exports generated across your meetings will show up here."
      />

      {isError ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<AlertTriangle />}
              title="Couldn't load downloads"
              description={extractErrorMessage(error)}
              action={
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : !isLoading && entries.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Download />}
              title="No downloads yet"
              description="Once a meeting finishes processing, its transcript will appear here for quick download."
            />
          </CardContent>
        </Card>
      ) : (
        <ExportHistory
          entries={entries}
          loading={isLoading}
          onDownload={downloadTranscript.isPending ? undefined : handleDownload}
        />
      )}
    </PageContainer>
  );
}
