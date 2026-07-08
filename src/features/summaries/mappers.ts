import type { SummaryResponse } from "@/features/summaries/types";
import type {
  ActionItemData,
  DecisionData,
  DiscussionTopicData,
  NextStepData,
  OpenQuestionData,
  RiskData,
} from "@/components/meetings/summary/types";

export type Summary = {
  id: string;
  meetingId: string;
  executiveSummary: string;
  topics: DiscussionTopicData[];
  decisions: DecisionData[];
  actionItems: ActionItemData[];
  risks: RiskData[];
  openQuestions: OpenQuestionData[];
  nextSteps: NextStepData[];
  createdAt: string;
  updatedAt: string;
};

export function toSummary(response: SummaryResponse): Summary {
  return {
    id: response.id,
    meetingId: response.meeting_id,
    executiveSummary: response.executive_summary,
    topics: response.topics.map((topic, index) => ({
      id: `${response.id}-topic-${index}`,
      title: topic.title,
      description: topic.description ?? undefined,
    })),
    decisions: response.decisions.map((decision, index) => ({
      id: `${response.id}-decision-${index}`,
      text: decision.text,
    })),
    actionItems: response.action_items.map((item, index) => ({
      id: `${response.id}-action-item-${index}`,
      text: item.text,
      assignee: item.owner ? { id: item.owner, name: item.owner } : undefined,
      dueDate: item.due_date ?? undefined,
      status: "not-started",
    })),
    risks: response.risks.map((risk, index) => ({
      id: `${response.id}-risk-${index}`,
      text: risk.text,
    })),
    openQuestions: response.open_questions.map((question, index) => ({
      id: `${response.id}-open-question-${index}`,
      text: question.text,
    })),
    nextSteps: response.next_steps.map((step, index) => ({
      id: `${response.id}-next-step-${index}`,
      text: step.text,
    })),
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}
