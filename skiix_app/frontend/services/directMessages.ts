import { supabase } from "@/lib/supabase";

export type DirectMessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
};

export async function fetchThread(meId: string, peerId: string, takePerDirection = 200) {
  const cols = "id, sender_id, receiver_id, body, created_at";
  const [outbound, inbound] = await Promise.all([
    supabase
      .from("direct_messages")
      .select(cols)
      .eq("sender_id", meId)
      .eq("receiver_id", peerId)
      .order("created_at", { ascending: true })
      .limit(takePerDirection),
    supabase
      .from("direct_messages")
      .select(cols)
      .eq("sender_id", peerId)
      .eq("receiver_id", meId)
      .order("created_at", { ascending: true })
      .limit(takePerDirection),
  ]);
  const err = outbound.error ?? inbound.error;
  if (err) throw new Error(err.message);

  const byId = new Map<string, DirectMessageRow>();
  for (const row of [...(outbound.data ?? []), ...(inbound.data ?? [])]) {
    byId.set(row.id as string, row as DirectMessageRow);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export async function insertMessage(meId: string, peerId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Empty message");
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: meId, receiver_id: peerId, body: trimmed })
    .select("id, sender_id, receiver_id, body, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as DirectMessageRow;
}

/** Recent messages touching this user — client groups by counterpart. */
export async function fetchRecentForInbox(meId: string, take = 80) {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("id, sender_id, receiver_id, body, created_at")
    .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`)
    .order("created_at", { ascending: false })
    .limit(take);
  if (error) throw new Error(error.message);
  return (data ?? []) as DirectMessageRow[];
}

export function subscribeToDirectMessages(meId: string, onRow: (row: DirectMessageRow) => void) {
  const channel = supabase
    .channel(`direct_messages:user:${meId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "direct_messages" },
      (payload) => {
        const row = payload.new as Record<string, unknown> | undefined;
        if (!row?.id || !row.sender_id || !row.receiver_id) return;
        const sender = String(row.sender_id);
        const receiver = String(row.receiver_id);
        if (sender !== meId && receiver !== meId) return;
        onRow({
          id: String(row.id),
          sender_id: sender,
          receiver_id: receiver,
          body: String(row.body ?? ""),
          created_at: String(row.created_at ?? new Date().toISOString()),
        });
      },
    )
    .subscribe();
  return channel;
}
