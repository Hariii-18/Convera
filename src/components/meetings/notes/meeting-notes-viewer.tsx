"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { ActionItems } from "@/components/meetings/notes/action-items";
import { DetailedDiscussion } from "@/components/meetings/notes/detailed-discussion";
import { EditableActionItems } from "@/components/meetings/notes/editable/editable-action-items";
import { EditableDetailedDiscussion } from "@/components/meetings/notes/editable/editable-detailed-discussion";
import { EditableExecutiveSummary } from "@/components/meetings/notes/editable/editable-executive-summary";
import { EditableTextList } from "@/components/meetings/notes/editable/editable-text-list";
import { EditableTopics } from "@/components/meetings/notes/editable/editable-topics";
import { FullTranscript } from "@/components/meetings/notes/full-transcript";
import { MeetingNotesExportControl } from "@/components/meetings/notes/meeting-notes-export-control";
import { MeetingNotesHeader } from "@/components/meetings/notes/meeting-notes-header";
import { MeetingNotesToolbar } from "@/components/meetings/notes/meeting-notes-toolbar";
import { RisksBlockers } from "@/components/meetings/notes/risks-blockers";
import { buildMeetingNotesText } from "@/components/meetings/notes/format";
import { countWords } from "@/components/meetings/format";
import { DecisionsList } from "@/components/meetings/summary/decisions-list";
import { DiscussionTopics } from "@/components/meetings/summary/discussion-topics";
import { ExecutiveSummary } from "@/components/meetings/summary/executive-summary";
import { NextSteps } from "@/components/meetings/summary/next-steps";
import { OpenQuestions } from "@/components/meetings/summary/open-questions";
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
import type { MeetingNotesDraft } from "@/features/meeting-notes/mappers";
import type { MeetingNotesExportFormat } from "@/features/meeting-notes/types";
import type { MeetingNotesEmailSendPayload } from "@/components/meetings/notes/meeting-notes-email-dialog";

type MeetingNotesViewerProps = React.ComponentProps<"div"> & {
  title?: string;
  /** Backend-formatted IST string. Omit while notes aren't ready yet. */
  dateTimeIst?: string;
  durationSeconds?: number | null;
  executiveSummary?: string;
  discussionTopics?: DiscussionTopicData[];
  decisions?: DecisionData[];
  actionItems?: MeetingNotesActionItemData[];
  risks?: RiskData[];
  openQuestions?: OpenQuestionData[];
  nextSteps?: NextStepData[];
  detailedDiscussion?: TranscriptBlockData[];
  /** Same segments as `detailedDiscussion`, in the lossless (start+end)
   * shape editing needs. Required for `editMode` to be offered at all. */
  timestampedDiscussion?: MeetingNotesSegmentData[];
  fullTranscript?: string;
  /** Renders every section's skeleton state. */
  loading?: boolean;
  onTimestampClick?: (seconds: number) => void;
  onCopy?: () => void;
  onCopyTranscript?: () => void;

  /** Omit to hide the Edit/Save/Cancel controls entirely (e.g. while loading). */
  editMode?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  onSave?: (draft: MeetingNotesDraft) => void;
  saving?: boolean;

  /** Omit to hide the Export control entirely. */
  exportFormat?: MeetingNotesExportFormat;
  onExportFormatChange?: (format: MeetingNotesExportFormat) => void;
  onDownload?: () => void;
  downloading?: boolean;
  /** Authenticated user's own address, shown in the email dialog's "Send to
   * me" option. */
  ownEmail?: string;
  onSendEmail?: (payload: MeetingNotesEmailSendPayload) => Promise<void>;
  sendingEmail?: boolean;
};

/**
 * Full Meeting Notes document: header (title, IST date/time, duration) over
 * the executive summary, discussion topics, decisions, action items,
 * risks/blockers, open questions, next steps, timestamped detailed
 * discussion, and the full transcript.
 *
 * Owns its own edit *draft* (the in-progress values while `editMode` is on)
 * but not `editMode` itself — that's controlled by the caller, same pattern
 * as `TranscriptViewer`'s `editMode`. `onSave` is only ever called with the
 * draft; saving it (and updating the underlying data) is the caller's job.
 * Full Transcript is never part of the draft — there is nothing here that
 * can edit it.
 */
function MeetingNotesViewer({
  className,
  title,
  dateTimeIst,
  durationSeconds,
  executiveSummary,
  discussionTopics,
  decisions,
  actionItems,
  risks,
  openQuestions,
  nextSteps,
  detailedDiscussion,
  timestampedDiscussion,
  fullTranscript,
  loading = false,
  onTimestampClick,
  onCopy,
  onCopyTranscript,
  editMode = false,
  onEditModeChange,
  onSave,
  saving = false,
  exportFormat,
  onExportFormatChange,
  onDownload,
  downloading = false,
  ownEmail,
  onSendEmail,
  sendingEmail = false,
  ...props
}: MeetingNotesViewerProps) {
  const notesText = React.useMemo(
    () =>
      buildMeetingNotesText({
        title,
        dateTimeIst,
        durationSeconds,
        executiveSummary,
        discussionTopics,
        decisions,
        actionItems,
        risks,
        openQuestions,
        nextSteps,
      }),
    [
      title,
      dateTimeIst,
      durationSeconds,
      executiveSummary,
      discussionTopics,
      decisions,
      actionItems,
      risks,
      openQuestions,
      nextSteps,
    ],
  );

  const wordCount = React.useMemo(() => countWords(notesText), [notesText]);

  // Re-seeds the draft from the latest props each time edit mode is
  // (re-)entered — mirrors the "reset on a new upstream value" pattern the
  // meeting page already uses for transcript/summary edits (see
  // `MeetingPage`'s `lastTranscriptId`/`lastSummaryId`), just keyed off
  // `editMode` transitioning rather than a data id.
  const [draft, setDraft] = React.useState<MeetingNotesDraft | null>(null);
  const [wasEditMode, setWasEditMode] = React.useState(editMode);
  if (editMode !== wasEditMode) {
    setWasEditMode(editMode);
    if (editMode) {
      setDraft({
        title: title ?? "",
        executiveSummary: executiveSummary ?? "",
        discussionTopics: discussionTopics ?? [],
        decisions: decisions ?? [],
        actionItems: actionItems ?? [],
        risks: risks ?? [],
        openQuestions: openQuestions ?? [],
        nextSteps: nextSteps ?? [],
        timestampedDiscussion: timestampedDiscussion ?? [],
      });
    }
  }

  const isEditing = editMode && draft !== null;

  return (
    <div
      data-slot="meeting-notes-viewer"
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <MeetingNotesHeader
        title={isEditing ? draft.title : title}
        dateTimeIst={dateTimeIst}
        durationSeconds={durationSeconds}
        loading={loading}
        editMode={isEditing}
        onTitleChange={(value) => setDraft((current) => current && { ...current, title: value })}
      />

      <MeetingNotesToolbar
        notesText={notesText}
        wordCount={wordCount > 0 ? wordCount : undefined}
        onCopy={onCopy}
        editMode={isEditing}
        onEdit={onEditModeChange ? () => onEditModeChange(true) : undefined}
        onCancel={() => onEditModeChange?.(false)}
        onSave={() => draft && onSave?.(draft)}
        saving={saving}
      />

      {exportFormat !== undefined && (
        <MeetingNotesExportControl
          format={exportFormat}
          onFormatChange={(format) => onExportFormatChange?.(format)}
          onDownload={onDownload}
          downloading={downloading}
          ownEmail={ownEmail}
          onSendEmail={onSendEmail}
          sendingEmail={sendingEmail}
        />
      )}

      {isEditing ? (
        <EditableExecutiveSummary
          summary={draft.executiveSummary}
          onChange={(value) =>
            setDraft((current) => current && { ...current, executiveSummary: value })
          }
        />
      ) : (
        <ExecutiveSummary summary={executiveSummary} loading={loading} />
      )}

      {isEditing ? (
        <EditableTopics
          topics={draft.discussionTopics}
          onChange={(value) =>
            setDraft((current) => current && { ...current, discussionTopics: value })
          }
        />
      ) : (
        <DiscussionTopics topics={discussionTopics} loading={loading} />
      )}

      {isEditing ? (
        <EditableTextList
          heading="Decisions"
          items={draft.decisions}
          onChange={(value) => setDraft((current) => current && { ...current, decisions: value })}
          addLabel="Add decision"
          placeholder="Decision"
          makeItem={() => ({ id: crypto.randomUUID(), text: "" })}
        />
      ) : (
        <DecisionsList decisions={decisions} loading={loading} />
      )}

      {isEditing ? (
        <EditableActionItems
          items={draft.actionItems}
          onChange={(value) => setDraft((current) => current && { ...current, actionItems: value })}
        />
      ) : (
        <ActionItems items={actionItems} loading={loading} />
      )}

      {isEditing ? (
        <EditableTextList
          heading="Risks / Blockers"
          items={draft.risks}
          onChange={(value) => setDraft((current) => current && { ...current, risks: value })}
          addLabel="Add risk"
          placeholder="Risk or blocker"
          makeItem={() => ({ id: crypto.randomUUID(), text: "" })}
        />
      ) : (
        <RisksBlockers risks={risks} loading={loading} />
      )}

      {isEditing ? (
        <EditableTextList
          heading="Open Questions"
          items={draft.openQuestions}
          onChange={(value) =>
            setDraft((current) => current && { ...current, openQuestions: value })
          }
          addLabel="Add question"
          placeholder="Open question"
          makeItem={() => ({ id: crypto.randomUUID(), text: "" })}
        />
      ) : (
        <OpenQuestions questions={openQuestions} loading={loading} />
      )}

      {isEditing ? (
        <EditableTextList
          heading="Next Steps"
          items={draft.nextSteps}
          onChange={(value) => setDraft((current) => current && { ...current, nextSteps: value })}
          addLabel="Add next step"
          placeholder="Next step"
          makeItem={() => ({ id: crypto.randomUUID(), text: "" })}
        />
      ) : (
        <NextSteps steps={nextSteps} loading={loading} />
      )}

      {isEditing ? (
        <EditableDetailedDiscussion
          segments={draft.timestampedDiscussion}
          onChange={(value) =>
            setDraft((current) => current && { ...current, timestampedDiscussion: value })
          }
        />
      ) : (
        <DetailedDiscussion
          segments={detailedDiscussion}
          loading={loading}
          onTimestampClick={onTimestampClick}
        />
      )}

      <FullTranscript
        transcript={fullTranscript}
        loading={loading}
        onCopy={onCopyTranscript}
      />
    </div>
  );
}

export { MeetingNotesViewer };
export type { MeetingNotesViewerProps };
