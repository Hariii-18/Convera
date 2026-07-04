"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { ActionItems } from "@/components/meetings/summary/action-items";
import { DecisionsList } from "@/components/meetings/summary/decisions-list";
import { DiscussionTopics } from "@/components/meetings/summary/discussion-topics";
import { ExecutiveSummary } from "@/components/meetings/summary/executive-summary";
import { NextSteps } from "@/components/meetings/summary/next-steps";
import { OpenQuestions } from "@/components/meetings/summary/open-questions";
import { Risks } from "@/components/meetings/summary/risks";
import { SummaryToolbar } from "@/components/meetings/summary/summary-toolbar";
import { countWords } from "@/components/meetings/format";
import { buildSummaryText } from "@/components/meetings/summary/format";
import type {
  ActionItemData,
  DecisionData,
  DiscussionTopicData,
  NextStepData,
  OpenQuestionData,
  RiskData,
} from "@/components/meetings/summary/types";

type SummaryViewerProps = React.ComponentProps<"div"> & {
  executiveSummary?: string;
  topics?: DiscussionTopicData[];
  decisions?: DecisionData[];
  actionItems?: ActionItemData[];
  risks?: RiskData[];
  openQuestions?: OpenQuestionData[];
  nextSteps?: NextStepData[];
  /** Renders every section's skeleton state. */
  loading?: boolean;
  onToggleActionItem?: (id: string) => void;
  onCopy?: () => void;
  /** Presentational placeholder — the caller owns what exporting actually does. */
  onExport?: () => void;
  /** Presentational placeholder — the caller owns what regenerating actually does. */
  onRegenerate?: () => void;
};

/**
 * Full meeting summary: a toolbar over the executive summary, discussion
 * topics, decisions, action items, risks, open questions, and next steps.
 * Every section renders independently from props alone and manages its own
 * empty/loading state — no AI, no API calls, no fabricated content.
 */
function SummaryViewer({
  className,
  executiveSummary,
  topics,
  decisions,
  actionItems,
  risks,
  openQuestions,
  nextSteps,
  loading = false,
  onToggleActionItem,
  onCopy,
  onExport,
  onRegenerate,
  ...props
}: SummaryViewerProps) {
  const summaryText = React.useMemo(
    () =>
      buildSummaryText({
        executiveSummary,
        topics,
        decisions,
        actionItems,
        risks,
        openQuestions,
        nextSteps,
      }),
    [
      executiveSummary,
      topics,
      decisions,
      actionItems,
      risks,
      openQuestions,
      nextSteps,
    ],
  );

  const wordCount = React.useMemo(() => countWords(summaryText), [summaryText]);

  return (
    <div
      data-slot="summary-viewer"
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <SummaryToolbar
        summaryText={summaryText}
        wordCount={wordCount > 0 ? wordCount : undefined}
        onCopy={onCopy}
        onExport={onExport}
        onRegenerate={onRegenerate}
      />

      <ExecutiveSummary summary={executiveSummary} loading={loading} />
      <DiscussionTopics topics={topics} loading={loading} />
      <DecisionsList decisions={decisions} loading={loading} />
      <ActionItems
        items={actionItems}
        loading={loading}
        onToggleActionItem={onToggleActionItem}
      />
      <Risks risks={risks} loading={loading} />
      <OpenQuestions questions={openQuestions} loading={loading} />
      <NextSteps steps={nextSteps} loading={loading} />
    </div>
  );
}

export { SummaryViewer };
export type { SummaryViewerProps };
