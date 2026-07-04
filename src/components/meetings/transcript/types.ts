/**
 * Domain types for the Transcript Viewer. Shared by TranscriptViewer and its
 * subcomponents so a real page can pass one data shape straight through.
 */

export type TranscriptSpeaker = {
  id: string;
  name: string;
};

export type TranscriptBlockData = {
  id: string;
  /** Seconds from the start of the meeting. */
  timestampSeconds: number;
  /** Omit for transcripts without diarization. */
  speaker?: TranscriptSpeaker;
  text: string;
};
