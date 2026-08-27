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
import type { ActionItemEdits } from "@/components/meetings/summary/edit-action-item-dialog";
import type { MeetingNotesEmailSendPayload } from "@/components/meetings/notes/meeting-notes-email-dialog";
import type {
  ActionItemData,
  DecisionData,
  DiscussionTopicData,
  NextStepData,
  OpenQuestionData,
  RiskData,
} from "@/components/meetings/summary/types";
import type { SummaryExportFormat } from "@/features/summaries/types";

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
  /** IANA zone action item due dates render in (e.g. the user's timezone
   * preference). Defaults to the browser's local zone. */
  timeZone?: string;
  onToggleActionItem?: (id: string) => void;
  /** Persists a text/owner/due date/status edit made through the action
   * item edit dialog. Omit to hide the edit affordance. */
  onSaveActionItem?: (id: string, edits: ActionItemEdits) => void;
  /** Id of the action item currently being saved, if any. */
  pendingActionItemId?: string | null;
  onCopy?: () => void;
  /** Renders the currently saved summary to a format and saves it to disk.
   * Omit to disable the Export control entirely. */
  onExport?: (format: SummaryExportFormat) => void;
  /** Shows a spinner on the Export control while a download is in flight. */
  exporting?: boolean;
  /** Presentational placeholder — the caller owns what regenerating actually does. */
  onRegenerate?: () => void;
  /** Format the "Send to Email" dialog will render and attach. */
  emailFormat?: SummaryExportFormat;
  onEmailFormatChange?: (format: SummaryExportFormat) => void;
  /** Authenticated user's own address, shown in the email dialog's "Send to
   * me" option. */
  ownEmail?: string;
  /** Emails the currently saved Summary (rendered to `emailFormat`) to the
   * resolved recipient list. Omit to hide the Send to Email control
   * entirely. */
  onSendEmail?: (payload: MeetingNotesEmailSendPayload) => Promise<void>;
  sendingEmail?: boolean;
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
  timeZone,
  onToggleActionItem,
  onSaveActionItem,
  pendingActionItemId,
  onCopy,
  onExport,
  exporting = false,
  onRegenerate,
  emailFormat,
  onEmailFormatChange,
  ownEmail,
  onSendEmail,
  sendingEmail = false,
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
        exporting={exporting}
        onRegenerate={onRegenerate}
        emailFormat={emailFormat}
        onEmailFormatChange={onEmailFormatChange}
        ownEmail={ownEmail}
        onSendEmail={onSendEmail}
        sendingEmail={sendingEmail}
      />

      <ExecutiveSummary summary={executiveSummary} loading={loading} />
      <DiscussionTopics topics={topics} loading={loading} />
      <DecisionsList decisions={decisions} loading={loading} />
      <ActionItems
        items={actionItems}
        loading={loading}
        timeZone={timeZone}
        onToggleActionItem={onToggleActionItem}
        onSaveActionItem={onSaveActionItem}
        pendingItemId={pendingActionItemId}
      />
      <Risks risks={risks} loading={loading} />
      <OpenQuestions questions={openQuestions} loading={loading} />
      <NextSteps steps={nextSteps} loading={loading} />
    </div>
  );
}

export { SummaryViewer };
export type { SummaryViewerProps };
