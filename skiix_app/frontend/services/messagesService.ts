import { supabase } from "@/lib/supabase";

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string | null;
  media_url: string | null;
  created_at: string;
  is_deleted: boolean | null;
  is_edited: boolean | null;
};

const cols =
  "id, conversation_id, sender_id, content, message_type, media_url, created_at, is_deleted, is_edited";

export async function fetchConversationMessages(conversationId: string, limit = 100) {
  const { data, error } = await supabase
    .from("messages")
    .select(cols)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageRow[];
}

export async function insertConversationMessage(
  conversationId: string,
  senderId: string,
  content: string,
) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Empty message");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: trimmed,
      message_type: "text",
    })
    .select(cols)
    .single();
  if (error) throw new Error(error.message);
  return data as MessageRow;
}

export function subscribeToConversationMessages(
  conversationId: string,
  onRow: (row: MessageRow) => void,
) {
  return supabase
    .channel(`messages:conv:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown> | undefined;
        if (!row?.id || !row.conversation_id) return;
        onRow({
          id: String(row.id),
          conversation_id: String(row.conversation_id),
          sender_id: String(row.sender_id ?? ""),
          content: row.content != null ? String(row.content) : null,
          message_type: row.message_type != null ? String(row.message_type) : "text",
          media_url: row.media_url != null ? String(row.media_url) : null,
          created_at: String(row.created_at ?? new Date().toISOString()),
          is_deleted: Boolean(row.is_deleted),
          is_edited: Boolean(row.is_edited),
        });
      },
    )
    .subscribe();
}
