import { supabase } from "@/lib/supabase";
import { isMissingProfilesTableMessage } from "@/services/supabaseAuthService";

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Publishes auth email into profiles.email_normalized so DM can resolve peers by email.
 * Safe to call on every inbox / thread open; upserts only id + email_normalized.
 */
export async function ensureProfilesEmailNormalized(userId: string, email: string | null | undefined) {
  const n = normalizeEmail(email);
  if (!userId || !n) return { error: null as Error | null };
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email_normalized: n,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  const msg = String(error?.message ?? "");
  if (error && isMissingProfilesTableMessage(msg)) {
    return { error: null };
  }
  return { error: error ? new Error(msg) : null };
}

export type ProfileBrief = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  email_normalized: string | null;
};

export async function fetchProfilesByIds(ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, ProfileBrief>();
  if (!unique.length) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, email_normalized")
    .in("id", unique);

  const msg = String(error?.message ?? "");
  if (error && isMissingProfilesTableMessage(msg)) return map;
  if (error || !data) return map;

  for (const row of data as ProfileBrief[]) {
    if (row?.id) map.set(row.id, row);
  }
  return map;
}

export async function fetchPeerIdByEmail(peerEmail: string) {
  const e = normalizeEmail(peerEmail);
  if (!e) return { peerId: null as string | null, error: null as Error | null };
  const { data, error } = await supabase.rpc("peer_id_by_email", { p_email: e });
  if (error) return { peerId: null, error: new Error(error.message) };
  const id = typeof data === "string" ? data : data == null ? null : String(data);
  return { peerId: id, error: null };
}
