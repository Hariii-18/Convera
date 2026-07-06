"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Meeting } from "@/components/meetings/types";

type DeleteMeetingDialogProps = {
  meeting: Meeting | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
};

/** Controlled by `meeting`: rendering a meeting opens the dialog, `null` closes it. */
function DeleteMeetingDialog({
  meeting,
  onOpenChange,
  onConfirm,
  isPending = false,
}: DeleteMeetingDialogProps) {
  return (
    <Dialog open={meeting !== null} onOpenChange={onOpenChange}>
      <DialogContent data-slot="delete-meeting-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete meeting</DialogTitle>
          <DialogDescription>
            {meeting && (
              <>
                Are you sure you want to delete &ldquo;{meeting.title}&rdquo;?
                This can&apos;t be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter showCloseButton>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteMeetingDialog };
export type { DeleteMeetingDialogProps };
