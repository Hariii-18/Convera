"use client";

import * as React from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCreateMeetingSpeaker } from "@/features/meeting-speakers/hooks/use-create-meeting-speaker";
import { useDeleteMeetingSpeaker } from "@/features/meeting-speakers/hooks/use-delete-meeting-speaker";
import { useMeetingSpeakers } from "@/features/meeting-speakers/hooks/use-meeting-speakers";
import { useUpdateMeetingSpeaker } from "@/features/meeting-speakers/hooks/use-update-meeting-speaker";
import type { MeetingSpeakerResponse } from "@/features/meeting-speakers/types";

type SpeakerDraft = {
  displayName: string;
  role: string;
  company: string;
  notes: string;
};

function draftFromSpeaker(speaker: MeetingSpeakerResponse): SpeakerDraft {
  return {
    displayName: speaker.display_name,
    role: speaker.role ?? "",
    company: speaker.company ?? "",
    notes: speaker.notes ?? "",
  };
}

type SpeakersSectionProps = React.ComponentProps<"div"> & {
  meetingId: string;
  /** Set false while the meeting isn't ready yet (guest view, still loading). */
  enabled?: boolean;
};

/**
 * Minimal manual speaker roster for a meeting: list, add, rename, and
 * annotate `Speaker N` placeholders with role/company/notes. Self-contained
 * — owns its own fetch and mutations (`meetingId` is the only input) since
 * speakers are an independent resource, not part of the batched Meeting
 * Notes draft/save flow next to it.
 */
function SpeakersSection({
  className,
  meetingId,
  enabled = true,
  ...props
}: SpeakersSectionProps) {
  const { data: speakers, isLoading } = useMeetingSpeakers(meetingId, {
    enabled,
  });
  const createSpeaker = useCreateMeetingSpeaker(meetingId);
  const updateSpeaker = useUpdateMeetingSpeaker(meetingId);
  const deleteSpeaker = useDeleteMeetingSpeaker(meetingId);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<SpeakerDraft | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<MeetingSpeakerResponse | null>(null);

  function startEdit(speaker: MeetingSpeakerResponse) {
    setEditingId(speaker.id);
    setDraft(draftFromSpeaker(speaker));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEdit(speakerId: string) {
    if (!draft) return;
    updateSpeaker.mutate(
      {
        speakerId,
        payload: {
          display_name: draft.displayName.trim() || undefined,
          role: draft.role.trim() || null,
          company: draft.company.trim() || null,
          notes: draft.notes.trim() || null,
        },
      },
      { onSuccess: () => cancelEdit() },
    );
  }

  const isSaving = updateSpeaker.isPending;

  return (
    <Card data-slot="speakers-section" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Speakers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : !speakers || speakers.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No speakers added yet"
              description="Add speakers manually to attribute roles, companies, and notes. Diarization will populate this automatically in a future update."
            />
          ) : (
            <ul role="list" className="flex flex-col gap-3">
              {speakers.map((speaker) => {
                const isEditing = editingId === speaker.id && draft !== null;
                return (
                  <li
                    key={speaker.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3"
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <Input
                          value={draft.displayName}
                          placeholder="Display name"
                          aria-label="Display name"
                          onChange={(event) =>
                            setDraft(
                              (current) =>
                                current && {
                                  ...current,
                                  displayName: event.target.value,
                                },
                            )
                          }
                        />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Input
                            value={draft.role}
                            placeholder="Role"
                            aria-label="Role"
                            onChange={(event) =>
                              setDraft(
                                (current) =>
                                  current && {
                                    ...current,
                                    role: event.target.value,
                                  },
                              )
                            }
                          />
                          <Input
                            value={draft.company}
                            placeholder="Company"
                            aria-label="Company"
                            onChange={(event) =>
                              setDraft(
                                (current) =>
                                  current && {
                                    ...current,
                                    company: event.target.value,
                                  },
                              )
                            }
                          />
                        </div>
                        <Textarea
                          value={draft.notes}
                          placeholder="Notes"
                          aria-label="Notes"
                          rows={2}
                          onChange={(event) =>
                            setDraft(
                              (current) =>
                                current && {
                                  ...current,
                                  notes: event.target.value,
                                },
                            )
                          }
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                            disabled={isSaving}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveEdit(speaker.id)}
                            disabled={
                              isSaving || draft.displayName.trim().length === 0
                            }
                          >
                            {isSaving ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <p className="truncate text-sm font-medium text-foreground">
                            {speaker.display_name}
                          </p>
                          {(speaker.role || speaker.company) && (
                            <p className="truncate text-xs text-muted-foreground">
                              {[speaker.role, speaker.company]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {speaker.notes && (
                            <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
                              {speaker.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${speaker.display_name}`}
                            onClick={() => startEdit(speaker)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${speaker.display_name}`}
                            onClick={() => setDeleteTarget(speaker)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => createSpeaker.mutate({})}
            disabled={createSpeaker.isPending}
          >
            <Plus data-icon="inline-start" />
            {createSpeaker.isPending ? "Adding…" : "Add speaker"}
          </Button>
        </div>
      </CardContent>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent
          data-slot="delete-speaker-dialog"
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Delete speaker</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  Are you sure you want to delete &ldquo;
                  {deleteTarget.display_name}&rdquo;? This can&apos;t be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              disabled={deleteSpeaker.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteSpeaker.mutate(deleteTarget.id, {
                  onSuccess: () => setDeleteTarget(null),
                });
              }}
            >
              {deleteSpeaker.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export { SpeakersSection };
export type { SpeakersSectionProps };
