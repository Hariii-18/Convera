import { redirect } from "next/navigation";

// Profile and Settings used to maintain separate, overlapping views of the
// same account data. Settings is now the single place that manages it
// (name, password, timezone, notifications) -- this route stays live for
// existing links/bookmarks and just forwards there.
export default function ProfilePage() {
  redirect("/settings");
}
