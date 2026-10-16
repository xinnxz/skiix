import { Redirect } from "expo-router";

/** @deprecated Navigate to `/drafts` — kept for bookmarks and deep links */
export default function ReelDraftsRedirect() {
  return <Redirect href="/drafts" />;
}
