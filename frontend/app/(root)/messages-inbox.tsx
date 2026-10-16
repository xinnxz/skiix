import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/store/auth.store";
import { fetchRecentForInbox, subscribeToDirectMessages } from "@/services/directMessages";
import { ensureProfilesEmailNormalized, fetchProfilesByIds } from "@/services/profileIdentity";
import type { DirectMessageRow } from "@/services/directMessages";
import { supabase } from "@/lib/supabase";

type Row = {
  counterpartId: string;
  preview: DirectMessageRow;
};

function previewTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function MessagesInboxScreen() {
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const myEmail = user?.email ?? "";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildRows = useCallback((msgs: DirectMessageRow[], uid: string): Row[] => {
    const latest = new Map<string, DirectMessageRow>();
    for (const m of msgs) {
      const other = m.sender_id === uid ? m.receiver_id : m.sender_id;
      const cur = latest.get(other);
      if (!cur || new Date(m.created_at) > new Date(cur.created_at)) {
        latest.set(other, m);
      }
    }
    const summary = [...latest.entries()].map(([counterpartId, preview]) => ({
      counterpartId,
      preview,
    }));
    summary.sort(
      (a, b) =>
        new Date(b.preview.created_at).getTime() -
        new Date(a.preview.created_at).getTime(),
    );
    return summary;
  }, []);

  const load = useCallback(async () => {
    if (!meId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    await ensureProfilesEmailNormalized(meId, myEmail);
    try {
      const msgs = await fetchRecentForInbox(meId, 120);
      setRows(buildRows(msgs, meId));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [meId, myEmail, buildRows]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!meId) return undefined;

    const scheduleReload = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => void load(), 320);
    };

    const ch = subscribeToDirectMessages(meId, scheduleReload);
    return () => {
      supabase.removeChannel(ch);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [meId, load]);

  const [profiles, setProfiles] = useState<Awaited<ReturnType<typeof fetchProfilesByIds>>>(
    new Map(),
  );

  useEffect(() => {
    if (!rows.length) {
      setProfiles(new Map());
      return;
    }
    void fetchProfilesByIds(rows.map((r) => r.counterpartId)).then(setProfiles);
  }, [rows]);

  const openChat = (counterpartId: string) => {
    const brief = profiles.get(counterpartId);
    const em = brief?.email_normalized?.trim().toLowerCase() ?? "";
    router.push({
      pathname: "/dm",
      params: {
        peer: counterpartId,
        ...(em ? { with: encodeURIComponent(em) } : {}),
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
      <View className="flex-row items-center justify-center px-4 py-3 border-b border-[#FFFFFF10]">
        <TouchableOpacity
          hitSlop={12}
          onPress={() => router.back()}
          className="absolute left-3 p-2"
        >
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-[17px] font-bold">Messages</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00E5FF" />
          <Text className="text-[#94A3B8] text-sm mt-3">Loading conversations…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 px-8 justify-center items-center">
          <Ionicons name="chatbubbles-outline" size={54} color="#00E5FF55" />
          <Text className="text-[#94A3B8] text-center mt-6 leading-6 text-[15px]">
            No messages yet — open your Network tab and tap Message on someone you are connected with.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.counterpartId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 96 }}
          renderItem={({ item }) => {
            const pf = profiles.get(item.counterpartId);
            const title =
              pf?.username?.replace(/^@/, "") ?? pf?.email_normalized?.split("@")[0] ?? "Member";
            const subtitle = pf?.email_normalized ?? "";
            const avatar =
              pf?.avatar_url?.trim() ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=0A0F12&color=70DAFF`;
            const mine = item.preview.sender_id === meId;

            return (
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => openChat(item.counterpartId)}
                className="flex-row items-center py-4 border-b border-[#FFFFFF08]"
              >
                <Image
                  source={{ uri: avatar }}
                  className="w-[52px] h-[52px] rounded-[26px] border border-[#FFFFFF14]"
                />
                <View className="flex-1 ml-3">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-white font-bold text-[16px]" numberOfLines={1}>
                      {title.startsWith("@") ? title : `@${title}`}
                    </Text>
                    <Text className="text-[#64748B] text-[11px]">
                      {previewTime(item.preview.created_at)}
                    </Text>
                  </View>
                  {!!subtitle && (
                    <Text className="text-[#64748B] text-[11px] mt-0.5" numberOfLines={1}>
                      {subtitle}
                    </Text>
                  )}
                  <Text className="text-[#CBD5E1] text-[13px] mt-2" numberOfLines={2}>
                    {mine ? "You · " : ""}
                    {item.preview.body}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#475569" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
