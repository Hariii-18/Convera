"use client";

import * as React from "react";
import { Loader2, Mail, X } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { extractErrorMessage } from "@/features/auth/error";
import { cn } from "@/lib/utils";

const MAX_RECIPIENTS = 10;

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export type MeetingNotesEmailSendPayload = {
  sendToMe: boolean;
  recipients: string[];
};

type MeetingNotesEmailDialogProps = {
  /** Authenticated user's own address, shown next to "Send to me". */
  ownEmail?: string;
  /** True while a send is in flight — disables the trigger and Send button
   * so a duplicate click can't fire a second request. */
  sending?: boolean;
  onSend: (payload: MeetingNotesEmailSendPayload) => Promise<void>;
  /** Dialog title — defaults to the Meeting Notes copy. Overridden by other
   * callers (e.g. the Conversation view) that reuse this same dialog. */
  title?: string;
  /** Dialog description — defaults to the Meeting Notes copy. */
  description?: string;
};

/**
 * "Send to Email" trigger + dialog: a "Send to me" checkbox (default on),
 * an input to add further addresses as removable chips, and a Send button.
 * Validation (well-formed address, no duplicates, at most `MAX_RECIPIENTS`)
 * mirrors what the backend enforces — this is a head start on those errors,
 * not a replacement for them, so a failed send still surfaces the server's
 * message inline. Originally built for Meeting Notes; `title`/`description`
 * let other export flows (e.g. Conversation) reuse the same dialog.
 */
function MeetingNotesEmailDialog({
  ownEmail,
  sending = false,
  onSend,
  title = "Send Meeting Notes",
  description = "Emails the currently saved Meeting Notes in the selected format.",
}: MeetingNotesEmailDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [sendToMe, setSendToMe] = React.useState(true);
  const [recipients, setRecipients] = React.useState<string[]>([]);
  const [draftInput, setDraftInput] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const totalCount = recipients.length + (sendToMe ? 1 : 0);

  function resetDraft() {
    setSendToMe(true);
    setRecipients([]);
    setDraftInput("");
    setFieldError(null);
    setFormError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !sending) resetDraft();
    setOpen(nextOpen);
  }

  function isAlreadyAdded(address: string): boolean {
    const normalized = address.toLowerCase();
    if (sendToMe && ownEmail?.toLowerCase() === normalized) return true;
    return recipients.some((existing) => existing.toLowerCase() === normalized);
  }

  function addRecipient() {
    const parsed = emailSchema.safeParse(draftInput);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }
    if (isAlreadyAdded(parsed.data)) {
      setFieldError("That address is already in the list");
      return;
    }
    if (totalCount >= MAX_RECIPIENTS) {
      setFieldError(`You can add up to ${MAX_RECIPIENTS} recipients`);
      return;
    }
    setRecipients((current) => [...current, parsed.data]);
    setDraftInput("");
    setFieldError(null);
  }

  function removeRecipient(address: string) {
    setRecipients((current) => current.filter((existing) => existing !== address));
  }

  async function handleSend() {
    if (totalCount === 0 || sending) return;
    setFormError(null);
    try {
      await onSend({ sendToMe, recipients });
      resetDraft();
      setOpen(false);
    } catch (error) {
      setFormError(extractErrorMessage(error, "Couldn't send the email. Please try again."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" disabled={sending} />
        }
      >
        {sending ? (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        ) : (
          <Mail data-icon="inline-start" />
        )}
        Send to Email
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={sendToMe}
              onCheckedChange={(checked) => setSendToMe(checked === true)}
            />
            Send to me{ownEmail ? ` (${ownEmail})` : ""}
          </label>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="Add an email address"
                value={draftInput}
                onChange={(event) => {
                  setDraftInput(event.target.value);
                  if (fieldError) setFieldError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addRecipient();
                  }
                }}
                aria-invalid={fieldError ? true : undefined}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addRecipient}>
                Add
              </Button>
            </div>
            {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
          </div>

          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((address) => (
                <Badge key={address} variant="secondary" className="gap-1">
                  {address}
                  <button
                    type="button"
                    onClick={() => removeRecipient(address)}
                    aria-label={`Remove ${address}`}
                    className="rounded-full hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <p className={cn("text-xs text-muted-foreground", totalCount >= MAX_RECIPIENTS && "text-destructive")}>
            {totalCount} of {MAX_RECIPIENTS} recipients
          </p>

          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" onClick={handleSend} disabled={totalCount === 0 || sending}>
            {sending && <Loader2 data-icon="inline-start" className="animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { MeetingNotesEmailDialog };
export type { MeetingNotesEmailDialogProps };
