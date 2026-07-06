"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MeetingTitleInput } from "@/components/meetings/meeting-title-input";
import type { Meeting } from "@/components/meetings/types";

type RenameMeetingDialogProps = {
  meeting: Meeting | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (title: string) => void;
  isPending?: boolean;
};

/**
 * Controlled by `meeting`: rendering a meeting opens the dialog, `null` closes
 * it. Mirrors `NewMeetingModal`'s remount-on-open pattern so the input always
 * starts from the current title.
 */
function RenameMeetingDialog({
  meeting,
  onOpenChange,
  onConfirm,
  isPending = false,
}: RenameMeetingDialogProps) {
  return (
    <Dialog open={meeting !== null} onOpenChange={onOpenChange}>
      <DialogContent data-slot="rename-meeting-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rename meeting</DialogTitle>
          <DialogDescription>
            Choose a new title for this meeting.
          </DialogDescription>
        </DialogHeader>

        {meeting && (
          <RenameMeetingForm
            key={meeting.id}
            initialTitle={meeting.title}
            onConfirm={onConfirm}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type RenameMeetingFormProps = {
  initialTitle: string;
  onConfirm: (title: string) => void;
  isPending: boolean;
};

function RenameMeetingForm({
  initialTitle,
  onConfirm,
  isPending,
}: RenameMeetingFormProps) {
  const [title, setTitle] = React.useState(initialTitle);
  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialTitle;

  return (
    <>
      <MeetingTitleInput value={title} onChange={setTitle} autoFocus />

      <DialogFooter>
        <Button
          className="w-full sm:w-auto"
          disabled={!canSave || isPending}
          onClick={() => onConfirm(trimmed)}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

export { RenameMeetingDialog };
export type { RenameMeetingDialogProps };
