/**
 * Domain types for the Meeting Notes viewer. Shared by MeetingNotesViewer
 * and its subcomponents so a real page can pass one data shape straight
 * through. Several sections (topics, decisions, risks, open questions, next
 * steps) reuse the Summary viewer's types directly since the shapes are
 * identical — Meeting Notes composes the same summary data alongside
 * transcript timestamps, it doesn't re-derive it.
 */

export type MeetingNotesActionItemData = {
  id: string;
  text: string;
  /** Omit when the summary didn't record an owner for this item. */
  owner?: string;
  /** Omit when the summary didn't record a due date. Rendered as-is, no status is inferred. */
  dueDate?: string;
};

/** A Detailed Discussion segment in its lossless (start+end) shape — the
 * form editing needs so a text edit round-trips the whole segment back to
 * the API without dropping `end`. See `TranscriptBlockData` for the
 * display-only shape (rounded `timestampSeconds`, no `end`). */
export type MeetingNotesSegmentData = {
  id: string;
  start: number;
  end: number;
  text: string;
};
