import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/store/auth.store";
import { fetchRecentForInbox, insertMessage } from "@/services/directMessages";
import type { DirectMessageRow } from "@/services/directMessages";
import { fetchProfilesByIds } from "@/services/profileIdentity";
import { toast } from "sonner-native";

type Row = { id: string; name: string; avatar: string };

export default function ForwardPostScreen() {
  const { postId, preview } = useLocalSearchParams<{ postId?: string; preview?: string }>();
  const pid = typeof postId === "string" ? postId : "";
  const prev = typeof preview === "string" ? decodeURIComponent(preview) : "";
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const body = useMemo(
    () => `📎 Shared a Skiix post\n${prev}\nhttps://skiix.app/posts/${pid}`,
    [pid, prev],
  );

  const load = useCallback(async () => {
    if (!meId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const msgs = await fetchRecentForInbox(meId, 80);
      const latest = new Map<string, DirectMessageRow>();
      for (const m of msgs) {
        const other = m.sender_id === meId ? m.receiver_id : m.sender_id;
        const cur = latest.get(other);
        if (!cur || new Date(m.created_at) > new Date(cur.created_at)) {
          latest.set(other, m);
        }
      }
      const ids = [...latest.keys()];
      const profiles = await fetchProfilesByIds(ids);
      const out: Row[] = ids.map((id) => {
        const p = profiles.get(id);
        const name = p?.username?.trim() || id.slice(0, 6);
        const avatar =
          p?.avatar_url?.trim() ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0A0F12&color=70DAFF`;
        return { id, name, avatar };
      });
      setRows(out);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(s));
  }, [rows, q]);

  const sendTo = async (peerId: string) => {
    if (!meId || !pid) return;
    try {
      await insertMessage(meId, peerId, body);
      toast.success("Sent");
      router.back();
    } catch {
      toast.error("Could not send.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-4 py-2 border-b border-[#1F1F1F]">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text className="text-white font-spaceBold text-lg ml-3">Send in Skiix</Text>
      </View>

      <View className="px-4 py-3">
        <Text className="text-[#888] text-xs font-space mb-2">Post</Text>
        <Text className="text-white font-space text-sm" numberOfLines={3}>
          {prev || pid}
        </Text>
      </View>

      <TextInput
        className="mx-4 mb-3 rounded-xl bg-[#111] border border-[#1F1F1F] px-4 py-3 text-white font-space"
        placeholder="Search conversations…"
        placeholderTextColor="#888"
        value={q}
        onChangeText={setQ}
      />

      {loading ? (
        <ActivityIndicator color="#00E5FF" className="mt-6" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text className="text-[#888] font-space text-center mt-8">No conversations yet.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => void sendTo(item.id)}
              className="flex-row items-center py-3 border-b border-[#1F1F1F]"
            >
              <Image source={{ uri: item.avatar }} className="w-11 h-11 rounded-full" />
              <Text className="text-white font-spaceBold ml-3 flex-1">{item.name}</Text>
              <Ionicons name="chevron-forward" size={18} color="#888" />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
