import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/store/auth.store";
import {
  deleteNotification,
  fetchNotificationsForUser,
  subscribeToNotifications,
  type AppNotificationRow,
} from "@/services/appNotifications";
import { fetchProfilesByIds } from "@/services/profileIdentity";
import { connectionsApi } from "@/utils/connections.api";
import { supabase } from "@/lib/supabase";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const myEmail = (user?.email ?? "").trim().toLowerCase();
  const userId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AppNotificationRow[]>([]);
  const [actors, setActors] = useState<Map<string, { username: string | null; avatar_url: string | null }>>(
    new Map(),
  );
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchNotificationsForUser(userId, 80);
      setRows(list);
      const ids = [...new Set(list.map((r) => r.actor_user_id))];
      const map = await fetchProfilesByIds(ids);
      const next = new Map<string, { username: string | null; avatar_url: string | null }>();
      ids.forEach((id) => {
        const b = map.get(id);
        next.set(id, { username: b?.username ?? null, avatar_url: b?.avatar_url ?? null });
      });
      setActors(next);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/could not find the table|schema cache|relation|does not exist/i.test(msg)) {
        Alert.alert(
          "Notifications not configured",
          "Run app_notifications.sql in your Supabase SQL editor, then reopen this screen.",
        );
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!userId) return undefined;
    const ch = subscribeToNotifications(userId, () => void load());
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  const onAccept = async (n: AppNotificationRow) => {
    if (!myEmail) return;
    setActingId(n.id);
    try {
      await connectionsApi.accept(n.connection_id);
      await deleteNotification(n.id);
      await load();
    } catch (e: any) {
      Alert.alert("Could not accept", String(e?.message ?? e));
    } finally {
      setActingId(null);
    }
  };

  const onDecline = async (n: AppNotificationRow) => {
    if (!myEmail) return;
    setActingId(n.id);
    try {
      try {
        await connectionsApi.remove(myEmail, n.connection_id);
      } catch {
        // connection row may already be gone; continue clearing notification
      }
      await deleteNotification(n.id);
      await load();
    } catch (e: any) {
      Alert.alert("Could not dismiss", String(e?.message ?? e));
    } finally {
      setActingId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3 border-b border-[#FFFFFF10]">
        <TouchableOpacity hitSlop={12} onPress={() => router.back()} className="p-2 mr-2">
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-spaceBold flex-1">Notifications</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00E5FF" />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 px-8 justify-center items-center">
          <Ionicons name="notifications-outline" size={48} color="#00E5FF55" />
          <Text className="text-[#94A3BB] text-center mt-6 leading-6">
            You&apos;re all caught up. Collaboration invites appear here — accept with one tap.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 96 }}>
          {rows.map((n) => {
            const pf = actors.get(n.actor_user_id);
            const handle = pf?.username ? `@${pf.username}` : `Member`;
            const avatar =
              pf?.avatar_url?.trim() ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(handle)}&background=0A0F12&color=70DAFF`;
            const unread = !n.read_at;
            const isConnInvite = n.kind === "connection_request";

            const busy = actingId === n.id;

            return (
              <View
                key={n.id}
                className="rounded-3xl border border-[#FFFFFF12] mb-4 p-4"
                style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
              >
                <View className="flex-row">
                  <Image
                    source={{ uri: avatar }}
                    className="w-14 h-14 rounded-full border border-[#FFFFFF12]"
                  />
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-start justify-between">
                      <Text className="text-white font-spaceBold text-[16px] flex-1">{n.title}</Text>
                      {unread && (
                        <View className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] mt-2 ml-2" />
                      )}
                    </View>
                    <Text className="text-[#CBD5E1] text-sm mt-2 leading-5">{n.body}</Text>
                    <Text className="text-[#64748B] text-[11px] mt-2">{formatWhen(n.created_at)}</Text>
                  </View>
                </View>

                {isConnInvite && unread && (
                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      disabled={busy}
                      onPress={() => onAccept(n)}
                      className="flex-1 py-3 rounded-2xl items-center bg-[#00E5FF]"
                    >
                      {busy ? (
                        <ActivityIndicator color="#081018" />
                      ) : (
                        <Text className="text-[#081018] font-spaceBold text-xs uppercase tracking-wide">
                          Accept
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busy}
                      onPress={() => onDecline(n)}
                      className="flex-1 py-3 rounded-2xl items-center border border-[#FF6B7A66]"
                    >
                      <Text className="text-[#FF8A96] font-spaceBold text-xs uppercase tracking-wide">
                        Decline
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
