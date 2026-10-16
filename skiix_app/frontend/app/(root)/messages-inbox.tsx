import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/store/auth.store";
import {
  deleteConversationForMe,
  fetchConversations,
  toggleConversationMute,
  toggleConversationPin,
  type EligibleContact,
  type InboxConversation,
} from "@/services/conversationsService";
import { NewMessageModal } from "@/components/messages/NewMessageModal";
import { cleanHandle, displayFullName } from "@/utils/displayIdentity";
import { connectMessagingSocket, onMessagingEvent } from "@/services/messagingSocket";

function previewTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function lastMessagePreview(conv: InboxConversation, meId: string) {
  if (!conv.last_message) return "No messages yet";
  const prefix = conv.last_sender_id === meId ? "You: " : "";
  if (conv.last_message_type === "image") return `${prefix}📷 Photo`;
  if (conv.last_message_type === "video") return `${prefix}🎬 Video`;
  if (conv.last_message_type === "voice" || conv.last_message_type === "audio") {
    return `${prefix}🎤 Voice`;
  }
  if (conv.last_message_type === "document" || conv.last_message_type === "file") {
    return `${prefix}📎 File`;
  }
  return `${prefix}${conv.last_message}`;
}

function avatarUri(name: string, url?: string) {
  const trimmed = url?.trim();
  if (trimmed) return trimmed;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0A0F12&color=70DAFF`;
}

function stripAt(s: string) {
  return s.replace(/^@/, "").trim();
}

type Section =
  | { key: "pinned-header"; type: "header"; title: string }
  | { key: "messages-header"; type: "header"; title: string }
  | { key: "empty"; type: "empty" }
  | { key: string; type: "conversation"; data: InboxConversation };

export default function MessagesInboxScreen() {
  const { user, session } = useAuth();
  const meId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [search, setSearch] = useState("");
  const [newMessageOpen, setNewMessageOpen] = useState(false);

  const load = useCallback(async () => {
    if (!meId) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const convs = await fetchConversations();
      setConversations(convs);
    } catch (e) {
      if (__DEV__) console.error("[Inbox] load failed", e);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      if (session?.access_token) {
        connectMessagingSocket(session.access_token);
      }
    }, [load, session?.access_token]),
  );

  React.useEffect(() => {
    const unsub = onMessagingEvent((ev) => {
      if (
        ev.event === "message_received" ||
        ev.event === "message_sent" ||
        ev.event === "message_read"
      ) {
        void load();
      }
    });
    return unsub;
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.other_username.toLowerCase().includes(q) ||
        c.other_full_name.toLowerCase().includes(q) ||
        c.last_message.toLowerCase().includes(q),
    );
  }, [conversations, search]);

  const pinned = useMemo(() => filtered.filter((c) => c.is_pinned), [filtered]);
  const regular = useMemo(() => filtered.filter((c) => !c.is_pinned), [filtered]);

  const totalUnread = useMemo(
    () => conversations.reduce((n, c) => n + (c.unread_count ?? 0), 0),
    [conversations],
  );

  const sections = useMemo(() => {
    const items: Section[] = [];
    if (pinned.length) {
      items.push({ key: "pinned-header", type: "header", title: "PINNED" });
      for (const c of pinned) {
        items.push({ key: `conv-${c.id}`, type: "conversation", data: c });
      }
    }
    if (regular.length) {
      items.push({ key: "messages-header", type: "header", title: "INBOX" });
      for (const c of regular) {
        items.push({ key: `conv-${c.id}`, type: "conversation", data: c });
      }
    }
    if (!pinned.length && !regular.length && !loading) {
      items.push({ key: "empty", type: "empty" });
    }
    return [{ title: "inbox", data: items }];
  }, [pinned, regular, loading]);

  const openChat = (conv: InboxConversation) => {
    const un = cleanHandle(stripAt(conv.other_username)) || "member";
    const fn = displayFullName(conv.other_full_name, un);
    router.push({
      pathname: "/messages/[id]",
      params: {
        id: conv.id,
        userId: conv.other_user_id,
        username: un,
        ...(fn && fn !== un ? { fullName: encodeURIComponent(fn) } : {}),
        ...(conv.other_avatar_url?.trim() ? { avatarUrl: conv.other_avatar_url.trim() } : {}),
      },
    });
  };

  const startChat = (contact: EligibleContact) => {
    setNewMessageOpen(false);
    const un = cleanHandle(stripAt(contact.username)) || "member";
    const fn = displayFullName(contact.full_name, un);
    router.push({
      pathname: "/messages/[id]",
      params: {
        id: "new",
        userId: contact.id,
        username: un,
        ...(fn && fn !== un ? { fullName: encodeURIComponent(fn) } : {}),
        ...(contact.avatar_url?.trim() ? { avatarUrl: contact.avatar_url.trim() } : {}),
      },
    });
  };

  const onLongPressConversation = (conv: InboxConversation) => {
    const un = stripAt(conv.other_username) || "member";
    const fn = (conv.other_full_name || "").trim();
    const title = fn && !fn.includes("@") ? fn : `@${un}`;
    Alert.alert(title, undefined, [
      {
        text: conv.is_pinned ? "Unpin" : "📌 Pin conversation",
        onPress: async () => {
          try {
            await toggleConversationPin(conv.id, !conv.is_pinned);
            await load();
          } catch (e: unknown) {
            Alert.alert("Error", e instanceof Error ? e.message : String(e));
          }
        },
      },
      {
        text: conv.is_muted ? "Unmute" : "🔕 Mute notifications",
        onPress: async () => {
          try {
            await toggleConversationMute(conv.id, !conv.is_muted);
            await load();
          } catch (e: unknown) {
            Alert.alert("Error", e instanceof Error ? e.message : String(e));
          }
        },
      },
      {
        text: "🗑️ Delete conversation",
        style: "destructive",
        onPress: () => {
          Alert.alert("Delete conversation", "This removes the chat from your inbox.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                try {
                  await deleteConversationForMe(conv.id);
                  await load();
                } catch (e: unknown) {
                  Alert.alert("Error", e instanceof Error ? e.message : String(e));
                }
              },
            },
          ]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const renderConversation = (conv: InboxConversation) => {
    const un = cleanHandle(stripAt(conv.other_username)) || "member";
    const lineName = displayFullName(conv.other_full_name, un);
    const avatar = avatarUri(lineName, conv.other_avatar_url);

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => openChat(conv)}
        onLongPress={() => onLongPressConversation(conv)}
        className="flex-row items-center py-4 border-b border-[#FFFFFF08]"
      >
        <View className="relative">
          <Image
            source={{ uri: avatar }}
            className="w-[52px] h-[52px] rounded-[26px] border border-[#FFFFFF14]"
          />
          {conv.is_pinned && (
            <View className="absolute -top-1 -left-1 bg-black rounded-full p-0.5">
              <Ionicons name="pin" size={12} color="#00E5FF" />
            </View>
          )}
          {conv.is_online && (
            <View className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#22C55E] border-2 border-black" />
          )}
        </View>
        <View className="flex-1 ml-3">
          <View className="flex-row justify-between items-center">
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.convFullName} numberOfLines={1}>
                {lineName}
              </Text>
              <Text style={styles.convUsername}>@{un}</Text>
            </View>
            <Text className="text-[#64748B] text-[11px]">
              {previewTime(conv.last_message_at || conv.updated_at)}
            </Text>
          </View>
          <Text style={styles.convPreview} numberOfLines={1}>
            {lastMessagePreview(conv, meId)}
          </Text>
        </View>
        {conv.unread_count > 0 && (
          <View className="ml-2 min-w-[22px] h-[22px] rounded-full bg-[#00E5FF] items-center justify-center px-1.5">
            <Text className="text-black text-[11px] font-bold">
              {conv.unread_count > 99 ? "99+" : conv.unread_count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const chattedIds = useMemo(
    () => new Set(conversations.map((c) => c.other_user_id)),
    [conversations],
  );

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
      <View className="flex-row items-center justify-center px-4 py-3 border-b border-[#FFFFFF10]">
        <TouchableOpacity hitSlop={12} onPress={() => router.back()} className="absolute left-3 p-2">
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-[17px] font-bold">
          Inbox{totalUnread > 0 ? ` (${totalUnread > 99 ? "99+" : totalUnread})` : ""}
        </Text>
        <TouchableOpacity
          onPress={() => setNewMessageOpen(true)}
          className="absolute right-3 flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-[#00E5FF]"
        >
          <Ionicons name="create-outline" size={16} color="#000" />
          <Text className="text-black font-bold text-xs">New</Text>
        </TouchableOpacity>
      </View>

      <View className="px-4 py-3 border-b border-[#FFFFFF08]">
        <View className="flex-row items-center bg-[#1E2228] rounded-2xl px-3 py-2 border border-[#FFFFFF10]">
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search your conversations…"
            placeholderTextColor="#64748B"
            className="flex-1 ml-2 text-white text-[15px] py-1"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00E5FF" />
          <Text className="text-[#94A3B8] text-sm mt-3">Loading conversations…</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
          stickySectionHeadersEnabled={false}
          renderItem={({ item }) => {
            if (item.type === "header") {
              return (
                <Text className="text-[#64748B] text-[11px] font-bold tracking-widest mt-4 mb-1">
                  {item.title}
                </Text>
              );
            }
            if (item.type === "empty") {
              return (
                <View className="items-center py-10 px-4">
                  <Ionicons name="chatbubbles-outline" size={54} color="#00E5FF55" />
                  <Text className="text-white font-semibold text-[17px] mt-5">No messages yet</Text>
                  <Text className="text-[#94A3B8] text-center mt-2 leading-6 text-[14px]">
                    Tap New to message someone you follow, a follower, or a project teammate.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setNewMessageOpen(true)}
                    className="mt-6 px-6 py-3 rounded-full bg-[#00E5FF]"
                  >
                    <Text className="text-black font-bold">New Message</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return renderConversation(item.data);
          }}
        />
      )}

      <NewMessageModal
        visible={newMessageOpen}
        onClose={() => setNewMessageOpen(false)}
        onSelect={startChat}
        excludeIds={chattedIds}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  convFullName: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  convUsername: { fontSize: 12, color: "#888888", marginBottom: 2 },
  convPreview: { fontSize: 13, color: "#94A3B8", marginTop: 2 },
});
