import type { Href } from "expo-router";

/** Prefer stable backend user id over display slugs (username / email local-part). */
export function profilePathFromIds(userId?: string | null, slug?: string | null): Href | null {
  const id = userId?.trim();
  if (id) return `/profile/${encodeURIComponent(id)}` as Href;
  const s = slug?.trim().replace(/^@/, "");
  if (!s) return null;
  return `/profile/${encodeURIComponent(s)}` as Href;
}
