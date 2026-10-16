import { getApiBaseUrl } from "@/lib/apiBaseUrl";
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

/**
 * Resolve recipient user id for DMs — no backend `users` row required if they exist in `profiles`.
 * Order: profiles by email → profiles by username (handles inbox `with` = @handle) → Go users by email.
 */
export async function fetchPeerIdByEmail(peerEmailOrHandle: string) {
  const raw = (peerEmailOrHandle ?? "").trim().toLowerCase();
  if (!raw) return { peerId: null as string | null, error: null as Error | null };

  /** Email-shaped: match profiles.email_normalized */
  if (raw.includes("@")) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("email_normalized", raw)
      .maybeSingle();

    if (!error && data?.id) {
      return { peerId: String(data.id), error: null };
    }

    const profileErr = error ? String(error.message) : "";
    const base = getApiBaseUrl().replace(/\/$/, "");
    if (base && (!error || isMissingProfilesTableMessage(profileErr))) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(
          `${base}/api/v1/users/resolve-peer?email=${encodeURIComponent(raw)}`,
          { headers },
        );
        const json = (await res.json().catch(() => ({}))) as {
          data?: { user_id?: string };
        };
        if (res.ok && json.data?.user_id) {
          return { peerId: json.data.user_id, error: null };
        }
      } catch {
        // fall through
      }
    }

    if (error && !isMissingProfilesTableMessage(profileErr)) {
      return { peerId: null, error: new Error(profileErr) };
    }
    return { peerId: null, error: null };
  }

  /** Username / handle (DM routes often pass `with` as username, not email). */
  const uname = raw.replace(/^@/, "");
  if (!uname) return { peerId: null, error: null };

  const { data: byName, error: nameErr } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", uname)
    .limit(1);

  const nameMsg = nameErr ? String(nameErr.message) : "";
  if (!nameErr && byName?.[0]?.id) {
    return { peerId: String(byName[0].id), error: null };
  }
  if (nameErr && !isMissingProfilesTableMessage(nameMsg)) {
    return { peerId: null, error: new Error(nameMsg) };
  }

  /** Public profile slug on Go API (works when user finished onboarding there). */
  const base = getApiBaseUrl().replace(/\/$/, "");
  if (base) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${base}/api/v1/users/${encodeURIComponent(uname)}`, { headers });
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      if (res.ok && json.id) {
        return { peerId: json.id, error: null };
      }
    } catch {
      /* ignore */
    }
  }

  return { peerId: null, error: null };
}
