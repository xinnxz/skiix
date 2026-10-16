import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { supabase } from "@/lib/supabase";
import { fetchPeerIdByEmail } from "@/services/profileIdentity";

export type ResolvedDmPeer = {
  peerId: string | null;
  /** Login handle only (no @, never a full email). */
  username: string;
  /** Profile display name (maps to `display_name` on the server). */
  fullName: string;
  avatarUrl: string;
};

function looksLikeEmail(s: string) {
  const t = s.trim();
  return t.includes("@") && t.includes(".");
}

function sanitizeUsername(raw: string, emailLocalFallback: string) {
  const u = raw.trim().replace(/^@/, "");
  if (!u) return emailLocalFallback || "user";
  if (looksLikeEmail(u)) return emailLocalFallback || u.split("@")[0] || "user";
  return u;
}

/**
 * Resolve UUID + display fields for opening a DM from Network (we only have peer email there).
 * Uses resolve-peer + profile (no phantom user create). Falls back to Supabase profiles.
 */
export async function resolveDmPeerFromEmail(peerEmail: string): Promise<ResolvedDmPeer> {
  const email = peerEmail.trim().toLowerCase();
  const local = email.includes("@") ? email.split("@")[0]!.trim() : email;
  const fallbackUsername = sanitizeUsername("", local);

  const base = getApiBaseUrl().replace(/\/$/, "");
  if (!base) {
    const { peerId } = await fetchPeerIdByEmail(email);
    return {
      peerId,
      username: fallbackUsername,
      fullName: "",
      avatarUrl: "",
    };
  }

  let peerId: string | null = null;
  let username = fallbackUsername;
  let fullName = "";
  let avatarUrl = "";

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const rp = await fetch(`${base}/api/v1/users/resolve-peer?email=${encodeURIComponent(email)}`, {
      headers,
    });
    if (rp.ok) {
      const j = (await rp.json().catch(() => ({}))) as { data?: { user_id?: string } };
      peerId = j.data?.user_id?.trim() ?? null;
    }
  } catch {
    /* ignore */
  }

  if (peerId) {
    try {
      const um = await fetch(`${base}/api/v1/users/me?user_id=${encodeURIComponent(peerId)}`, {
        headers,
      });
      if (um.ok) {
        const u = (await um.json().catch(() => ({}))) as {
          username?: string;
          avatar_url?: string;
          display_name?: string;
        };
        username = sanitizeUsername(u.username ?? "", local);
        const dn = (u.display_name ?? "").trim();
        if (dn && !looksLikeEmail(dn)) fullName = dn;
        avatarUrl = (u.avatar_url ?? "").trim();
      }
    } catch {
      /* ignore */
    }
  }

  if (!peerId) {
    const { peerId: sid } = await fetchPeerIdByEmail(email);
    peerId = sid;
  }

  return { peerId, username, fullName, avatarUrl };
}
