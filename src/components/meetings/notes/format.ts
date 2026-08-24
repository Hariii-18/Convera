import { formatDuration } from "@/components/meetings/format";
import type {
  DecisionData,
  DiscussionTopicData,
  NextStepData,
  OpenQuestionData,
  RiskData,
} from "@/components/meetings/summary/types";
import type { MeetingNotesActionItemData } from "@/components/meetings/notes/types";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Action-item due dates come from the summarization prompt as free-text
 * (not guaranteed to be ISO-parseable — see `due_date` on
 * `MeetingNotesActionItemRead`). Formats it as a date when it parses
 * cleanly; otherwise renders the recorded text as-is rather than an
 * "Invalid Date" string.
 */
export function formatActionItemDueDate(dueDate: string): string {
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return dueDate;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Reformats the backend's "YYYY-MM-DD HH:MM:SS TZ" IST string (`date_time_ist`
 * on `MeetingNotesRead`) into a friendlier display string, e.g.
 * "Aug 24, 2026, 2:30 PM IST". The value is already localized to IST by the
 * backend — this only changes how it's displayed. Falls back to the raw
 * string if it doesn't match the expected shape, rather than throwing.
 */
export function formatIstDisplay(dateTimeIst: string): string {
  const match = dateTimeIst.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) (.+)$/,
  );
  if (!match) return dateTimeIst;

  const [, year, month, day, hour, minute, , tz] = match;
  const hourNum = Number(hour);
  const period = hourNum >= 12 ? "PM" : "AM";
  const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
  const monthName = MONTH_NAMES[Number(month) - 1] ?? month;

  return `${monthName} ${Number(day)}, ${year}, ${hour12}:${minute} ${period} ${tz}`;
}

type MeetingNotesTextInput = {
  title?: string;
  dateTimeIst?: string;
  durationSeconds?: number | null;
  executiveSummary?: string;
  discussionTopics?: DiscussionTopicData[];
  decisions?: DecisionData[];
  actionItems?: MeetingNotesActionItemData[];
  risks?: RiskData[];
  openQuestions?: OpenQuestionData[];
  nextSteps?: NextStepData[];
};

/**
 * Flattens the summary portion of Meeting Notes into one plain-text
 * document for the "Copy Notes" action. Pure formatting — omits sections
 * with no data. Excludes Detailed Discussion and Full Transcript, which
 * have their own copy actions.
 */
export function buildMeetingNotesText({
  title,
  dateTimeIst,
  durationSeconds,
  executiveSummary,
  discussionTopics = [],
  decisions = [],
  actionItems = [],
  risks = [],
  openQuestions = [],
  nextSteps = [],
}: MeetingNotesTextInput) {
  const sections: string[] = [];

  const header = [
    title,
    dateTimeIst ? formatIstDisplay(dateTimeIst) : undefined,
    durationSeconds != null ? formatDuration(durationSeconds) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  if (header) sections.push(header);

  if (executiveSummary) {
    sections.push(`Executive Summary\n${executiveSummary}`);
  }

  if (discussionTopics.length > 0) {
    sections.push(
      `Discussion Topics\n${discussionTopics
        .map((topic) =>
          topic.description
            ? `- ${topic.title}: ${topic.description}`
            : `- ${topic.title}`,
        )
        .join("\n")}`,
    );
  }

  if (decisions.length > 0) {
    sections.push(
      `Decisions\n${decisions.map((decision) => `- ${decision.text}`).join("\n")}`,
    );
  }

  if (actionItems.length > 0) {
    sections.push(
      `Action Items\n${actionItems
        .map((item) => {
          const details = [item.owner, item.dueDate].filter(Boolean).join(" · ");
          return `- ${item.text}${details ? ` (${details})` : ""}`;
        })
        .join("\n")}`,
    );
  }

  if (risks.length > 0) {
    sections.push(
      `Risks / Blockers\n${risks.map((risk) => `- ${risk.text}`).join("\n")}`,
    );
  }

  if (openQuestions.length > 0) {
    sections.push(
      `Open Questions\n${openQuestions
        .map((question) => `- ${question.text}`)
        .join("\n")}`,
    );
  }

  if (nextSteps.length > 0) {
    sections.push(
      `Next Steps\n${nextSteps.map((step) => `- ${step.text}`).join("\n")}`,
    );
  }

  return sections.join("\n\n");
}
