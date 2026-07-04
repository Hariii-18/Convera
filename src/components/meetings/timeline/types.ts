/**
 * Domain types for the Timeline Viewer. Shared by TimelineViewer and its
 * subcomponents so a real page can pass one data shape straight through.
 */

export type TimelineEventData = {
  id: string;
  /** Seconds from the start of the meeting. */
  timestampSeconds: number;
  title: string;
  description?: string;
  /** Omit for events without an attributed speaker. */
  speaker?: string;
};
