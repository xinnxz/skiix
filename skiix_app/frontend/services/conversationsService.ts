import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { supabase } from "@/lib/supabase";
import { cleanHandle } from "@/utils/displayIdentity";

export type ConversationRef = {
  id: string;
  recipient_id: string;
  is_group: boolean;
};

export type InboxConversation = {
  id: string;
  updated_at: string;
  other_user_id: string;
  other_username: string;
  other_full_name: string;
  other_avatar_url: string;
  last_message: string;
  last_message_type: string;
  last_message_at: string;
  last_sender_id: string;
  unread_count: number;
  is_pinned: boolean;
  is_muted?: boolean;
  is_online: boolean;
};

/** User the viewer is allowed to message (not entire database). */
export type EligibleContact = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  role_tag: string;
  source: string;
  is_online: boolean;
};

/** @deprecated Use EligibleContact via fetchEligibleContacts */
export type SuggestedUser = EligibleContact;

async function getApiAuth() {
  const base = getApiBaseUrl().replace(/\/$/, "");
  if (!base) throw new Error("API URL not configured (EXPO_PUBLIC_API_URL)");

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in");

  return {
    base,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
}

/**
 * GET /api/v1/conversations — inbox list with last message + unread counts.
 */
export async function fetchConversations(): Promise<InboxConversation[]> {
  const { base, headers } = await getApiAuth();

  const res = await fetch(`${base}/api/v1/conversations`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (__DEV__) console.log("[Conversations] Error:", res.status, text);
    throw new Error(text || `Could not load conversations (${res.status})`);
  }
  const json = (await res.json()) as { data?: InboxConversation[] };
  if (__DEV__) console.log("[Conversations] Data:", json.data?.length ?? 0, "rows");
  return (json.data ?? []).map((c) => ({
    ...c,
    other_username: cleanHandle(c.other_username) || "member",
    other_full_name: c.other_full_name?.trim() ?? "",
  }));
}

/**
 * GET /api/v1/messaging/contacts — followers, following, project peers, existing chats only.
 */
export async function fetchEligibleContacts(
  query = "",
  limit = 50,
): Promise<EligibleContact[]> {
  const { base, headers } = await getApiAuth();
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.trim()) params.set("q", query.trim());

  const res = await fetch(`${base}/api/v1/messaging/contacts?${params}`, { headers });
  if (!res.ok) {
    if (__DEV__) console.log("[EligibleContacts] Error:", res.status);
    return [];
  }
  const json = (await res.json()) as { data?: EligibleContact[] };
  return (json.data ?? []).map((u) => ({
    ...u,
    username: cleanHandle(u.username) || "member",
    full_name: u.full_name?.trim() ?? "",
  }));
}

/** @deprecated */
export const fetchSuggestedUsers = (limit = 50) => fetchEligibleContacts("", limit);

export async function fetchInboxUnreadCount(): Promise<number> {
  const { base, headers } = await getApiAuth();
  const res = await fetch(`${base}/api/v1/conversations/unread-count`, { headers });
  if (!res.ok) return 0;
  const json = (await res.json()) as { data?: { unread_count?: number } };
  return json.data?.unread_count ?? 0;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { base, headers } = await getApiAuth();
  await fetch(`${base}/api/v1/conversations/${conversationId}/read`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
}

export async function sendTypingIndicator(conversationId: string, typing: boolean): Promise<void> {
  const { base, headers } = await getApiAuth();
  await fetch(`${base}/api/v1/conversations/${conversationId}/typing`, {
    method: "POST",
    headers,
    body: JSON.stringify({ typing }),
  });
}

export async function createOrGetConversation(recipientId: string): Promise<ConversationRef> {
  const rid = recipientId.trim();
  if (!rid) throw new Error("recipient_id required");

  const { base, headers } = await getApiAuth();

  const res = await fetch(`${base}/api/v1/conversations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ recipient_id: rid }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: ConversationRef;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(json.error ?? `Could not open conversation (${res.status})`);
  }
  if (!json.data?.id) {
    throw new Error("Invalid conversation response");
  }
  return json.data;
}

export async function toggleConversationPin(conversationId: string, pinned: boolean) {
  const { base, headers } = await getApiAuth();

  const res = await fetch(`${base}/api/v1/conversations/${conversationId}/pin`, {
    method: "POST",
    headers,
    body: JSON.stringify({ pinned }),
  });
  if (!res.ok) {
    throw new Error(`Pin failed (${res.status})`);
  }
}

export async function toggleConversationMute(conversationId: string, muted: boolean) {
  const { base, headers } = await getApiAuth();

  const res = await fetch(`${base}/api/v1/conversations/${conversationId}/mute`, {
    method: "POST",
    headers,
    body: JSON.stringify({ muted }),
  });
  if (!res.ok) {
    throw new Error(`Mute failed (${res.status})`);
  }
}

export async function deleteConversationForMe(conversationId: string) {
  const { base, headers } = await getApiAuth();

  const res = await fetch(`${base}/api/v1/conversations/${conversationId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    throw new Error(`Delete failed (${res.status})`);
  }
}
