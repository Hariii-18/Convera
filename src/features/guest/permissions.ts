/**
 * Actions guests can trigger but that require a real account to complete.
 * Each maps to a one-sentence upgrade prompt shown in `GuestUpgradeDialog`.
 */
export type GuestRestrictedAction =
  | "save-meeting"
  | "view-history"
  | "rename-meeting"
  | "delete-meeting"
  | "manage-meeting"
  | "live-meeting"
  | "cloud-storage";

export const GUEST_UPGRADE_COPY: Record<GuestRestrictedAction, string> = {
  "save-meeting":
    "Create a free account to save your meetings and access them later.",
  "view-history": "Create a free account to view your meeting history.",
  "rename-meeting": "Create a free account to rename your meetings.",
  "delete-meeting": "Create a free account to delete your meetings.",
  "manage-meeting":
    "Create a free account to duplicate or archive your meetings.",
  "live-meeting":
    "Create a free account to capture live meetings from your browser.",
  "cloud-storage": "Create a free account to store your meetings in the cloud.",
};
