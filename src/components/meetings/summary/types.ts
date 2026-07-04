/**
 * Domain types for the Summary Viewer. Shared by SummaryViewer and its
 * subcomponents so a real page can pass one data shape straight through.
 */

export type DiscussionTopicData = {
  id: string;
  title: string;
  description?: string;
};

export type DecisionData = {
  id: string;
  text: string;
  /** Seconds from the start of the meeting. Omit when the moment is unknown. */
  timestampSeconds?: number;
};

export type ActionItemStatus =
  "not-started" | "in-progress" | "completed" | "blocked";

export type ActionItemAssignee = {
  id: string;
  name: string;
};

export type ActionItemData = {
  id: string;
  text: string;
  assignee?: ActionItemAssignee;
  dueDate?: string | Date;
  status: ActionItemStatus;
};

export type RiskData = {
  id: string;
  text: string;
};

export type OpenQuestionData = {
  id: string;
  text: string;
};

export type NextStepData = {
  id: string;
  text: string;
};
