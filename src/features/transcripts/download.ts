import type { Transcript } from "@/features/transcripts/mappers";

const MIME_TYPES = {
  txt: "text/plain;charset=utf-8",
  json: "application/json;charset=utf-8",
} as const;

export type TranscriptDownloadFormat = keyof typeof MIME_TYPES;

function toFileContent(transcript: Transcript, format: TranscriptDownloadFormat): string {
  if (format === "json") {
    return JSON.stringify(
      {
        id: transcript.id,
        meetingId: transcript.meetingId,
        language: transcript.language,
        duration: transcript.duration,
        wordCount: transcript.wordCount,
        blocks: transcript.blocks,
      },
      null,
      2,
    );
  }

  return transcript.text;
}

/** Triggers a client-side file download for an already-fetched transcript. No network request. */
export function downloadTranscriptFile(
  transcript: Transcript,
  format: TranscriptDownloadFormat,
  fileName: string,
): void {
  const blob = new Blob([toFileContent(transcript, format)], { type: MIME_TYPES[format] });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
