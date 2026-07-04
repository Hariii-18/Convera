import {
  ClipboardList,
  Download,
  FileText,
  History,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Sections of the meeting workspace. Content per tab is owned by whatever
 * consumes `MeetingWorkspaceLayout` — this module only describes the shell.
 */
export type WorkspaceTabValue =
  | "overview"
  | "transcript"
  | "summary"
  | "timeline"
  | "downloads";

export type WorkspaceTab = {
  value: WorkspaceTabValue;
  label: string;
  icon: LucideIcon;
};

export const workspaceTabs: WorkspaceTab[] = [
  { value: "overview", label: "Overview", icon: ClipboardList },
  { value: "transcript", label: "Transcript", icon: FileText },
  { value: "summary", label: "Summary", icon: Sparkles },
  { value: "timeline", label: "Timeline", icon: History },
  { value: "downloads", label: "Downloads", icon: Download },
];

/** Id of the tab trigger for a workspace tab, referenced by its panel's `aria-labelledby`. */
export function getWorkspaceTabTriggerId(value: WorkspaceTabValue) {
  return `workspace-tab-trigger-${value}`;
}

/** Id of the tab panel for a workspace tab, referenced by its trigger's `aria-controls`. */
export function getWorkspaceTabPanelId(value: WorkspaceTabValue) {
  return `workspace-tab-panel-${value}`;
}
