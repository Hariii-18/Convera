import type { LucideIcon } from "lucide-react";
import { Mic, MonitorPlay, Upload } from "lucide-react";

/**
 * Domain type for meeting sources. Shared by MeetingSourceSelector and any
 * future consumer of the new-meeting flow.
 */
export type MeetingSourceId =
  | "upload-recording"
  | "live-browser-meeting"
  | "microphone-recording";

export type MeetingSourceOption = {
  id: MeetingSourceId;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const meetingSourceOptions: MeetingSourceOption[] = [
  {
    id: "upload-recording",
    title: "Upload Recording",
    description: "Add an existing audio or video file",
    icon: Upload,
  },
  {
    id: "live-browser-meeting",
    title: "Live Browser Meeting",
    description: "Capture a meeting straight from your browser",
    icon: MonitorPlay,
  },
  {
    id: "microphone-recording",
    title: "Microphone Recording",
    description: "Record directly from your microphone",
    icon: Mic,
  },
];
