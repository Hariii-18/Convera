"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MeetingSourceSelector } from "@/components/meetings/meeting-source-selector";
import { MeetingTitleInput } from "@/components/meetings/meeting-title-input";
import type { MeetingSourceId } from "@/components/meetings/meeting-source";
import {
  newMeetingSchema,
  type NewMeetingFormValues,
} from "@/features/meetings/schemas";

type NewMeetingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when Continue is pressed. Presentational only — the caller owns
   * whatever happens next (routing, upload, recording, etc).
   */
  onContinue?: (data: { title: string; source: MeetingSourceId }) => void;
};

/**
 * Entry point for starting a new meeting: title + source selection, gated
 * behind a single primary action. Open state is fully controlled by the
 * caller; the form itself is remounted (via `key`) on every open so it
 * always starts from a clean slate, without an effect-driven reset.
 */
function NewMeetingModal({
  open,
  onOpenChange,
  onContinue,
}: NewMeetingModalProps) {
  const [instance, setInstance] = React.useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setInstance((value) => value + 1);
        onOpenChange(next);
      }}
    >
      <DialogContent data-slot="new-meeting-modal" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New meeting</DialogTitle>
          <DialogDescription>
            Name your meeting and choose how you&apos;d like to capture it.
          </DialogDescription>
        </DialogHeader>

        <NewMeetingForm key={instance} onContinue={onContinue} />
      </DialogContent>
    </Dialog>
  );
}

type NewMeetingFormProps = {
  onContinue?: (data: { title: string; source: MeetingSourceId }) => void;
};

function NewMeetingForm({ onContinue }: NewMeetingFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NewMeetingFormValues>({
    resolver: zodResolver(newMeetingSchema),
    defaultValues: { title: "", source: undefined },
  });

  function onSubmit(values: NewMeetingFormValues) {
    onContinue?.({
      title: values.title,
      source: values.source as MeetingSourceId,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-5">
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <MeetingTitleInput
              value={field.value}
              onChange={field.onChange}
              error={errors.title?.message}
              autoFocus
            />
          )}
        />

        <div className="flex flex-col gap-2">
          <span
            id="new-meeting-source-label"
            className="text-sm font-medium text-foreground"
          >
            Meeting source
          </span>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <MeetingSourceSelector
                value={field.value as MeetingSourceId | undefined}
                onChange={field.onChange}
                aria-labelledby="new-meeting-source-label"
              />
            )}
          />
          {errors.source && (
            <p className="text-xs text-destructive">
              {errors.source.message}
            </p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full sm:w-auto">
          Continue
        </Button>
      </DialogFooter>
    </form>
  );
}

export { NewMeetingModal };
export type { NewMeetingModalProps };
