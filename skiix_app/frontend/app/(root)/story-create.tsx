import { Redirect } from "expo-router";

/** Use `/create-story` — kept for backwards links from older UI. */
export default function StoryCreateRedirect() {
  return <Redirect href="/create-story" />;
}
