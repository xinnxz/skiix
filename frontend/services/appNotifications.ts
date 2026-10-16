import { supabase } from "@/lib/supabase";

export type AppNotificationRow = {
  id: string;
  user_id: string;
  actor_user_id: string;
  kind: string;
  connection_id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchNotificationsForUser(userId: string, take = 50) {
  const { data, error } = await supabase
    .from("app_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(take);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotificationRow[];
}

export async function countUnreadNotifications(userId: string) {
  try {
    const { count, error } = await supabase
      .from("app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from("app_notifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertConnectionInviteNotification(p: {
  recipientUserId: string;
  actorUserId: string;
  connectionId: string;
  title: string;
  body: string;
}) {
  const { error } = await supabase.from("app_notifications").insert({
    user_id: p.recipientUserId,
    actor_user_id: p.actorUserId,
    kind: "connection_request",
    connection_id: p.connectionId,
    title: p.title,
    body: p.body,
  });
  if (error) {
    // duplicate invite for same connection id
    if (error.code === "23505") return { ok: false as const, duplicate: true, error };
    throw new Error(error.message);
  }
  return { ok: true as const, duplicate: false };
}

export function subscribeToNotifications(userId: string, onEvent: () => void) {
  return supabase
    .channel(`app_notifications:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_notifications", filter: `user_id=eq.${userId}` },
      () => onEvent(),
    )
    .subscribe();
}
