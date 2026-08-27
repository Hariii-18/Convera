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
import type { ExportFormat, ExportHistoryEntry } from "@/components/meetings/downloads/types";
import { extractErrorMessage } from "@/features/auth/error";
import { useUserTimezone } from "@/features/auth/hooks/use-user-timezone";
import { useMeetings } from "@/features/meetings/hooks/use-meetings";
import { useDownloadTranscript } from "@/features/transcripts/hooks/use-download-transcript";
import type { TranscriptDownloadFormat } from "@/features/transcripts/download";
import { useDownloadMeetingNotesExport } from "@/features/meeting-notes/hooks/use-download-meeting-notes-export";
import type { MeetingNotesExportFormat } from "@/features/meeting-notes/types";

function parseEntryId(id: string): { meetingId: string; format: ExportFormat } {
  const [meetingId, format] = id.split(":") as [string, ExportFormat];
  return { meetingId, format };
}

const TRANSCRIPT_FORMATS: TranscriptDownloadFormat[] = ["txt", "json"];
// Deliberately excludes "pptx" — `ExportHistoryEntry.format` (shared with
// the per-meeting Downloads tab) has no slide-deck format.
const NOTES_FORMATS: Extract<MeetingNotesExportFormat, "pdf" | "docx">[] = ["pdf", "docx"];

export default function DownloadsPage() {
  const timeZone = useUserTimezone();
  const { data: meetings, isLoading, isError, error, refetch } = useMeetings();
  const downloadTranscript = useDownloadTranscript();
  const downloadMeetingNotes = useDownloadMeetingNotesExport();

  // Every entry below is rendered fresh from the meeting's current
  // transcript/summary on click (see `handleDownload`) - this is a list of
  // formats available to export right now, not a record of exports that
  // already happened, so there's no separate "export history" to fetch or
  // fabricate.
  const entries: ExportHistoryEntry[] = useMemo(() => {
    const completed = (meetings ?? [])
      .filter((meeting) => meeting.status === "completed")
      .sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    return completed.flatMap((meeting) => [
      ...NOTES_FORMATS.map((format) => ({
        id: `${meeting.id}:${format}`,
        fileName: `${meeting.title}.${format}`,
        format,
        generatedAt: meeting.updatedAt,
      })),
      ...TRANSCRIPT_FORMATS.map((format) => ({
        id: `${meeting.id}:${format}`,
        fileName: `${meeting.title}.${format}`,
        format,
        generatedAt: meeting.updatedAt,
      })),
    ]);
  }, [meetings]);

  function handleDownload(entry: ExportHistoryEntry) {
    const { meetingId, format } = parseEntryId(entry.id);
    if (format === "pdf" || format === "docx") {
      downloadMeetingNotes.mutate(
        { meetingId, format },
        {
          onSuccess: (downloadedFormat) =>
            toast.success(`${downloadedFormat.toUpperCase()} downloaded`),
          onError: (mutationError) => toast.error(extractErrorMessage(mutationError)),
        },
      );
      return;
    }
    downloadTranscript.mutate(
      { meetingId, format, fileName: entry.fileName },
      {
        onSuccess: () => toast.success(`Downloaded "${entry.fileName}"`),
        onError: (mutationError) => toast.error(extractErrorMessage(mutationError)),
      },
    );
  }

  const isDownloading = downloadTranscript.isPending || downloadMeetingNotes.isPending;

  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Downloads"
        description="Export your completed meetings as Meeting Notes (PDF/DOCX) or as a raw transcript (TXT/JSON)."
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
              description="Once a meeting finishes processing, its Meeting Notes and transcript will appear here for quick download."
            />
          </CardContent>
        </Card>
      ) : (
        <ExportHistory
          entries={entries}
          loading={isLoading}
          timeZone={timeZone}
          onDownload={isDownloading ? undefined : handleDownload}
        />
      )}
    </PageContainer>
  );
}
