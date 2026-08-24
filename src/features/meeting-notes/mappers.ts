import type {
  MeetingNotesResponse,
  MeetingNotesUpdateRequest,
} from "@/features/meeting-notes/types";
import type {
  DecisionData,
  DiscussionTopicData,
  NextStepData,
  OpenQuestionData,
  RiskData,
} from "@/components/meetings/summary/types";
import type {
  MeetingNotesActionItemData,
  MeetingNotesSegmentData,
} from "@/components/meetings/notes/types";
import type { TranscriptBlockData } from "@/components/meetings/transcript/types";

export type MeetingNotes = {
  id: string;
  meetingId: string;
  title: string;
  dateTimeUtc: string;
  dateTimeIst: string;
  durationSeconds: number | null;
  participantsCount: number | null;
  executiveSummary: string;
  discussionTopics: DiscussionTopicData[];
  decisions: DecisionData[];
  actionItems: MeetingNotesActionItemData[];
  risks: RiskData[];
  openQuestions: OpenQuestionData[];
  nextSteps: NextStepData[];
  /** Timestamped transcript segments underlying the summary above, shaped
   * for read-only rendering (`TranscriptBlock` reuse). */
  detailedDiscussion: TranscriptBlockData[];
  /** Same segments as `detailedDiscussion` but keeping `end` — the shape
   * editing needs so a text edit can round-trip the full segment (start,
   * end, text) back to the API without losing `end`. */
  timestampedDiscussion: MeetingNotesSegmentData[];
  /** Contiguous transcript text (normalized when available). Never editable. */
  fullTranscript: string;
  createdAt: string;
  updatedAt: string;
};

export function toMeetingNotes(response: MeetingNotesResponse): MeetingNotes {
  return {
    id: response.id,
    meetingId: response.meeting_id,
    title: response.title,
    dateTimeUtc: response.date_time_utc,
    dateTimeIst: response.date_time_ist,
    durationSeconds: response.duration_seconds,
    participantsCount: response.participants_count,
    executiveSummary: response.executive_summary,
    discussionTopics: response.discussion_topics.map((topic, index) => ({
      id: `${response.meeting_id}-topic-${index}`,
      title: topic.title,
      description: topic.description ?? undefined,
    })),
    decisions: response.decisions.map((decision, index) => ({
      id: `${response.meeting_id}-decision-${index}`,
      text: decision.text,
    })),
    actionItems: response.action_items.map((item, index) => ({
      id: `${response.meeting_id}-action-item-${index}`,
      text: item.text,
      owner: item.owner ?? undefined,
      dueDate: item.due_date ?? undefined,
    })),
    risks: response.risks.map((risk, index) => ({
      id: `${response.meeting_id}-risk-${index}`,
      text: risk.text,
    })),
    openQuestions: response.open_questions.map((question, index) => ({
      id: `${response.meeting_id}-open-question-${index}`,
      text: question.text,
    })),
    nextSteps: response.next_steps.map((step, index) => ({
      id: `${response.meeting_id}-next-step-${index}`,
      text: step.text,
    })),
    detailedDiscussion: response.timestamped_discussion.map((segment, index) => ({
      id: `${response.meeting_id}-segment-${index}`,
      timestampSeconds: Math.round(segment.start),
      text: segment.text,
    })),
    timestampedDiscussion: response.timestamped_discussion.map((segment, index) => ({
      id: `${response.meeting_id}-segment-${index}`,
      start: segment.start,
      end: segment.end,
      text: segment.text,
    })),
    fullTranscript: response.full_transcript,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

/** Editable subset of `MeetingNotes` — everything a user can change via the
 * Edit/Save flow. Excludes ids and the fields that are always derived live
 * (`dateTime*`/`durationSeconds`/`participantsCount`/`fullTranscript`) since
 * there is nothing to save them back to (see `MeetingNotesUpdateRequest`).
 */
export type MeetingNotesDraft = {
  title: string;
  executiveSummary: string;
  discussionTopics: DiscussionTopicData[];
  decisions: DecisionData[];
  actionItems: MeetingNotesActionItemData[];
  risks: RiskData[];
  openQuestions: OpenQuestionData[];
  nextSteps: NextStepData[];
  timestampedDiscussion: MeetingNotesSegmentData[];
};

export function toMeetingNotesDraft(notes: MeetingNotes): MeetingNotesDraft {
  return {
    title: notes.title,
    executiveSummary: notes.executiveSummary,
    discussionTopics: notes.discussionTopics.map((topic) => ({ ...topic })),
    decisions: notes.decisions.map((decision) => ({ ...decision })),
    actionItems: notes.actionItems.map((item) => ({ ...item })),
    risks: notes.risks.map((risk) => ({ ...risk })),
    openQuestions: notes.openQuestions.map((question) => ({ ...question })),
    nextSteps: notes.nextSteps.map((step) => ({ ...step })),
    timestampedDiscussion: notes.timestampedDiscussion.map((segment) => ({ ...segment })),
  };
}

export function toMeetingNotesUpdateRequest(draft: MeetingNotesDraft): MeetingNotesUpdateRequest {
  return {
    title: draft.title,
    executive_summary: draft.executiveSummary,
    discussion_topics: draft.discussionTopics.map((topic) => ({
      title: topic.title,
      description: topic.description ?? null,
    })),
    decisions: draft.decisions.map((decision) => ({ text: decision.text })),
    action_items: draft.actionItems.map((item) => ({
      text: item.text,
      owner: item.owner ?? null,
      due_date: item.dueDate ?? null,
      status: null,
    })),
    risks: draft.risks.map((risk) => ({ text: risk.text })),
    open_questions: draft.openQuestions.map((question) => ({ text: question.text })),
    next_steps: draft.nextSteps.map((step) => ({ text: step.text })),
    timestamped_discussion: draft.timestampedDiscussion.map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text,
    })),
  };
}
