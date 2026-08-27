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
import type { ProcessingJob } from "@/features/processing/mappers";

type CancelProcessingDialogProps = {
  job: ProcessingJob | null;
  meetingTitle?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
};

/** Controlled by `job`: rendering a job opens the dialog, `null` closes it. */
function CancelProcessingDialog({
  job,
  meetingTitle,
  onOpenChange,
  onConfirm,
  isPending = false,
}: CancelProcessingDialogProps) {
  return (
    <Dialog open={job !== null} onOpenChange={onOpenChange}>
      <DialogContent data-slot="cancel-processing-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel processing</DialogTitle>
          <DialogDescription>
            {job && (
              <>
                Are you sure you want to cancel processing for &ldquo;
                {meetingTitle ?? "this meeting"}&rdquo;? This can&apos;t be undone.
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
            Cancel processing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { CancelProcessingDialog };
export type { CancelProcessingDialogProps };
