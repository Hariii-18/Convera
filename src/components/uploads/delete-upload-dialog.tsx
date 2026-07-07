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
import type { Upload } from "@/features/uploads/mappers";

type DeleteUploadDialogProps = {
  upload: Upload | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
};

/** Controlled by `upload`: rendering an upload opens the dialog, `null` closes it. */
function DeleteUploadDialog({
  upload,
  onOpenChange,
  onConfirm,
  isPending = false,
}: DeleteUploadDialogProps) {
  return (
    <Dialog open={upload !== null} onOpenChange={onOpenChange}>
      <DialogContent data-slot="delete-upload-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete upload</DialogTitle>
          <DialogDescription>
            {upload && (
              <>
                Are you sure you want to delete &ldquo;{upload.originalFilename}
                &rdquo;? This can&apos;t be undone.
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

export { DeleteUploadDialog };
export type { DeleteUploadDialogProps };
