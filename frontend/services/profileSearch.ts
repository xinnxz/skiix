import { supabase } from "@/lib/supabase";
import { isMissingProfilesTableMessage } from "@/services/supabaseAuthService";

export type ProfileSearchHit = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  email_normalized: string | null;
};

/**
 * Case-insensitive username search; strips leading @. Requires profiles table + RLS read access.
 */
export async function searchProfilesByUsername(
  query: string,
  opts?: { excludeUserId?: string; limit?: number },
): Promise<ProfileSearchHit[]> {
  const raw = query.trim().replace(/^@+/, "");
  if (raw.length < 2) return [];

  const pattern = `%${raw}%`;
  const limit = opts?.limit ?? 20;

  let q = supabase
    .from("profiles")
    .select("id, username, avatar_url, email_normalized")
    .not("username", "is", null)
    .ilike("username", pattern)
    .limit(limit);

  if (opts?.excludeUserId) {
    q = q.neq("id", opts.excludeUserId);
  }

  const { data, error } = await q;
  const msg = String(error?.message ?? "");
  if (error && isMissingProfilesTableMessage(msg)) return [];
  if (error) throw new Error(msg);

  return (data ?? []) as ProfileSearchHit[];
}
