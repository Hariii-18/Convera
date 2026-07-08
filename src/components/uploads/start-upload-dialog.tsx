"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MeetingTitleInput } from "@/components/meetings/meeting-title-input";
import type { Meeting } from "@/components/meetings/types";

type StartUploadTab = "existing" | "new";

type StartUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetings: Meeting[];
  isCreatingMeeting?: boolean;
  onSelectExisting: (meetingId: string) => void;
  onCreateNew: (title: string) => void;
};

/**
 * Entry point for uploading a recording: either attach it to an existing
 * meeting or create a new one first. Every path here ends with a concrete
 * meeting id, so the caller can hand off straight into `UploadDialog`.
 */
function StartUploadDialog({
  open,
  onOpenChange,
  meetings,
  isCreatingMeeting = false,
  onSelectExisting,
  onCreateNew,
}: StartUploadDialogProps) {
  const [instance, setInstance] = React.useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setInstance((value) => value + 1);
        onOpenChange(next);
      }}
    >
      <DialogContent data-slot="start-upload-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload recording</DialogTitle>
          <DialogDescription>
            Every upload needs a meeting to belong to.
          </DialogDescription>
        </DialogHeader>

        <StartUploadForm
          key={instance}
          meetings={meetings}
          isCreatingMeeting={isCreatingMeeting}
          onSelectExisting={onSelectExisting}
          onCreateNew={onCreateNew}
        />
      </DialogContent>
    </Dialog>
  );
}

type StartUploadFormProps = Omit<
  StartUploadDialogProps,
  "open" | "onOpenChange"
>;

function StartUploadForm({
  meetings,
  isCreatingMeeting = false,
  onSelectExisting,
  onCreateNew,
}: StartUploadFormProps) {
  const [tab, setTab] = React.useState<StartUploadTab>(
    meetings.length > 0 ? "existing" : "new",
  );
  const [selectedMeetingId, setSelectedMeetingId] = React.useState<
    string | undefined
  >(undefined);
  const [newTitle, setNewTitle] = React.useState("");

  function handleContinue() {
    if (tab === "existing") {
      if (selectedMeetingId) onSelectExisting(selectedMeetingId);
      return;
    }
    const title = newTitle.trim();
    if (title) onCreateNew(title);
  }

  const canContinue =
    tab === "existing" ? Boolean(selectedMeetingId) : Boolean(newTitle.trim());

  return (
    <>
      <Tabs value={tab} onValueChange={(value) => setTab(value as StartUploadTab)}>
        <TabsList>
          <TabsTrigger value="existing">Existing meeting</TabsTrigger>
          <TabsTrigger value="new">New meeting</TabsTrigger>
        </TabsList>

        <TabsContent value="existing" className="pt-4">
          {meetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any meetings yet. Create one instead.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Meeting
              </span>
              <Select
                value={selectedMeetingId}
                onValueChange={(value) => setSelectedMeetingId(value as string)}
              >
                <SelectTrigger aria-label="Select a meeting">
                  <SelectValue placeholder="Choose a meeting…" />
                </SelectTrigger>
                <SelectContent>
                  {meetings.map((meeting) => (
                    <SelectItem key={meeting.id} value={meeting.id}>
                      {meeting.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="pt-4">
          <MeetingTitleInput
            value={newTitle}
            onChange={setNewTitle}
            autoFocus={tab === "new"}
          />
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button
          className="w-full sm:w-auto"
          disabled={!canContinue || isCreatingMeeting}
          onClick={handleContinue}
        >
          {tab === "new" && isCreatingMeeting ? "Creating…" : "Continue"}
        </Button>
      </DialogFooter>
    </>
  );
}

export { StartUploadDialog };
export type { StartUploadDialogProps };
