"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GUEST_UPGRADE_COPY } from "@/features/guest/permissions";
import type { GuestRestrictedAction } from "@/features/guest/permissions";

type GuestUpgradeDialogProps = {
  action: GuestRestrictedAction | null;
  onOpenChange: (open: boolean) => void;
};

/** Controlled by `action`: rendering an action opens the dialog, `null` closes it. */
function GuestUpgradeDialog({ action, onOpenChange }: GuestUpgradeDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={action !== null} onOpenChange={onOpenChange}>
      <DialogContent data-slot="guest-upgrade-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a free account</DialogTitle>
          <DialogDescription>
            {action && GUEST_UPGRADE_COPY[action]}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Continue as Guest
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => router.push("/register")}
          >
            Create Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { GuestUpgradeDialog };
export type { GuestUpgradeDialogProps };
