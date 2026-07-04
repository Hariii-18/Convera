import { formatTimestamp } from "@/components/meetings/format";
import { actionItemStatusConfig } from "@/components/meetings/summary/action-item-status";
import type {
  ActionItemData,
  DecisionData,
  DiscussionTopicData,
  NextStepData,
  OpenQuestionData,
  RiskData,
} from "@/components/meetings/summary/types";

/** "1 min read", "6 min read" — 200 words per minute, rounded up. */
export function formatReadingTime(wordCount: number) {
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
}

type SummaryTextInput = {
  executiveSummary?: string;
  topics?: DiscussionTopicData[];
  decisions?: DecisionData[];
  actionItems?: ActionItemData[];
  risks?: RiskData[];
  openQuestions?: OpenQuestionData[];
  nextSteps?: NextStepData[];
};

/**
 * Flattens every section into one plain-text document for the "Copy
 * Summary" action. Pure formatting — omits sections with no data.
 */
export function buildSummaryText({
  executiveSummary,
  topics = [],
  decisions = [],
  actionItems = [],
  risks = [],
  openQuestions = [],
  nextSteps = [],
}: SummaryTextInput) {
  const sections: string[] = [];

  if (executiveSummary) {
    sections.push(`Executive Summary\n${executiveSummary}`);
  }

  if (topics.length > 0) {
    sections.push(
      `Discussion Topics\n${topics
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
      `Decisions\n${decisions
        .map((decision) =>
          decision.timestampSeconds !== undefined
            ? `- ${decision.text} (${formatTimestamp(decision.timestampSeconds)})`
            : `- ${decision.text}`,
        )
        .join("\n")}`,
    );
  }

  if (actionItems.length > 0) {
    sections.push(
      `Action Items\n${actionItems
        .map((item) => {
          const checked = item.status === "completed" ? "x" : " ";
          const details = [
            item.assignee?.name,
            actionItemStatusConfig[item.status].label,
          ]
            .filter(Boolean)
            .join(" · ");
          return `- [${checked}] ${item.text}${details ? ` (${details})` : ""}`;
        })
        .join("\n")}`,
    );
  }

  if (risks.length > 0) {
    sections.push(`Risks\n${risks.map((risk) => `- ${risk.text}`).join("\n")}`);
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
