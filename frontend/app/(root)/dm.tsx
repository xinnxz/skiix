import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/store/auth.store";
import {
  fetchThread,
  insertMessage,
  subscribeToDirectMessages,
  type DirectMessageRow,
} from "@/services/directMessages";
import {
  ensureProfilesEmailNormalized,
  fetchPeerIdByEmail,
  fetchProfilesByIds,
  type ProfileBrief,
} from "@/services/profileIdentity";
import { supabase } from "@/lib/supabase";

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function formatDmTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

type Bubble = {
  id: string;
  text: string;
  outbound: boolean;
  createdAt: string;
};

function mapRow(meId: string, row: DirectMessageRow): Bubble {
  return {
    id: row.id,
    text: row.body,
    outbound: row.sender_id === meId,
    createdAt: row.created_at,
  };
}

export default function DirectMessageScreen() {
  const params = useLocalSearchParams<{ with?: string | string[]; peer?: string | string[] }>();
  const { user } = useAuth();

  const meId = user?.id ?? "";
  const myEmail = (user?.email ?? "").trim();

  const rawWith = one(params.with) ?? "";
  const rawPeerId = one(params.peer) ?? "";

  const encoded = rawWith.trim();
  const peerEmailGuess = useMemo(() => {
    try {
      return decodeURIComponent(encoded).trim().toLowerCase();
    } catch {
      return encoded.trim().toLowerCase();
    }
  }, [encoded]);

  const peerIdFromRoute = rawPeerId.trim();

  const [peerIdResolved, setPeerIdResolved] = useState<string | null>(peerIdFromRoute || null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [peerProfile, setPeerProfile] = useState<ProfileBrief | null>(null);
  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [booting, setBooting] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Bubble>>(null);

  /** Sync current user row so peers can DM by email lookup. */
  useEffect(() => {
    if (!meId || !myEmail) return;
    void ensureProfilesEmailNormalized(meId, myEmail);
  }, [meId, myEmail]);

  /** Resolve counterpart UUID — prefer explicit peer id from inbox. */
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setResolveError(null);
      if (!meId) {
        setBooting(false);
        return;
      }
      if (peerIdFromRoute) {
        setResolveError(null);
        setPeerIdResolved(peerIdFromRoute);
        return;
      }
      if (!peerEmailGuess || peerEmailGuess === myEmail.trim().toLowerCase()) {
        setResolveError(peerEmailGuess ? "You cannot DM yourself." : "Missing recipient.");
        setPeerIdResolved(null);
        setBooting(false);
        return;
      }
      const { peerId, error } = await fetchPeerIdByEmail(peerEmailGuess);
      if (cancelled) return;
      if (error) {
        setResolveError(error.message);
        setPeerIdResolved(null);
        setBooting(false);
        return;
      }
      if (!peerId) {
        setResolveError(
          "That Skiix member is not reachable yet — they need an account login so their inbox can sync.",
        );
        setPeerIdResolved(null);
        setBooting(false);
        return;
      }
      setPeerIdResolved(peerId);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [meId, peerEmailGuess, myEmail, peerIdFromRoute]);

  const peerDisplayName = peerProfile?.username
    ? peerProfile.username.startsWith("@")
      ? peerProfile.username
      : `@${peerProfile.username}`
    : peerProfile?.email_normalized?.split("@")[0] ??
      peerEmailGuess.split("@")[0] ??
      "Chat";

  const peerSubtitle = peerProfile?.email_normalized ?? peerEmailGuess;

  const hydratePeerMeta = useCallback(async (pid: string) => {
    const map = await fetchProfilesByIds([pid]);
    setPeerProfile(map.get(pid) ?? null);
  }, []);

  /** Load transcript + realtime. */
  useEffect(() => {
    if (!peerIdResolved || !meId) return undefined;

    let cancelled = false;
    let realtime: ReturnType<typeof subscribeToDirectMessages> | null = null;

    async function boot() {
      setBooting(true);
      await hydratePeerMeta(peerIdResolved);
      if (cancelled) return;

      try {
        const thread = await fetchThread(meId, peerIdResolved);
        if (cancelled) return;
        setMsgs(thread.map((r) => mapRow(meId, r)));
      } catch (e: any) {
        if (!cancelled) {
          Alert.alert("Could not load messages", String(e?.message ?? e));
          setMsgs([]);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }

      realtime = subscribeToDirectMessages(meId, (row) => {
        const ours =
          (row.sender_id === meId && row.receiver_id === peerIdResolved) ||
          (row.sender_id === peerIdResolved && row.receiver_id === meId);
        if (!ours) return;

        const next = mapRow(meId, row);
        setMsgs((prev) => {
          if (prev.some((m) => m.id === next.id)) return prev;
          return [...prev, next].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);
      });
    }

    void boot();

    return () => {
      cancelled = true;
      if (realtime) supabase.removeChannel(realtime);
    };
  }, [meId, peerIdResolved, hydratePeerMeta]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !peerIdResolved || !meId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const row = await insertMessage(meId, peerIdResolved, text);
      const next = mapRow(meId, row);
      setMsgs((prev) => {
        if (prev.some((m) => m.id === next.id)) return prev;
        return [...prev, next].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);
    } catch (e: any) {
      Alert.alert("Send failed", String(e?.message ?? e));
    } finally {
      setSending(false);
    }
  };

  const headerAvatarUri =
    peerProfile?.avatar_url?.trim() ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(peerDisplayName)}&background=0A0F12&color=70DAFF`;

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-3 pb-3 pt-2 border-b border-[#FFFFFF0F]">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-2">
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>

        <View className="flex-1 flex-row items-center px-2">
          <Image
            source={{ uri: headerAvatarUri }}
            style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "#333" }}
          />
          <View className="flex-1 ml-3">
            <Text className="text-white font-bold text-[17px]" numberOfLines={1}>
              {peerDisplayName}
            </Text>
            <View className="flex-row items-center mt-1">
              <View className="w-2 h-2 rounded-full bg-[#22C55E] mr-1.5" />
              <Text className="text-[#94A3B8] text-[11px] font-semibold tracking-wide">
                ACTIVE NOW
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity hitSlop={12} className="p-2 opacity-85" accessibilityLabel="Voice call">
          <Ionicons name="call-outline" size={22} color="#E2E8F0" />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={12} className="p-2 opacity-85" accessibilityLabel="Video call">
          <Ionicons name="videocam-outline" size={24} color="#E2E8F0" />
        </TouchableOpacity>
      </View>

      {!peerIdResolved && (
        <View className="flex-1 items-center justify-center px-6">
          {resolveError ? (
            <Text className="text-center text-[#94A3B8] leading-6">{resolveError}</Text>
          ) : (
            <>
              <ActivityIndicator color="#00E5FF" />
              <Text className="text-[#94A3B8] mt-4 text-sm">Finding recipient…</Text>
            </>
          )}
        </View>
      )}

      {peerIdResolved && (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <View className="flex-1">
            {booting && msgs.length === 0 ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="#00E5FF" />
                <Text className="text-[#94A3B8] mt-4 text-sm">Loading messages…</Text>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={msgs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item }) => (
                  <View className={`mb-3 ${item.outbound ? "items-end" : "items-start"}`}>
                    <View
                      className="max-w-[82%]"
                      style={{
                        backgroundColor: item.outbound ? "#00E5FF" : "#2F343A",
                        borderRadius: item.outbound ? 20 : 16,
                        borderTopLeftRadius: item.outbound ? 20 : 6,
                        borderTopRightRadius: item.outbound ? 6 : 16,
                        borderWidth: item.outbound ? 0 : 1,
                        borderColor: "#FFFFFF12",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: item.outbound ? "#081018" : "rgba(255,255,255,0.95)",
                          fontSize: 15,
                          lineHeight: 22,
                        }}
                      >
                        {item.text}
                      </Text>
                      <Text
                        className={`text-[11px] mt-2 ${item.outbound ? "text-[#0A4D5C]" : "text-[#94A3B8]"}`}
                      >
                        {formatDmTime(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  !booting ? (
                    <Text className="text-[#94A3BB] leading-7 mt-10 px-4 text-[15px]">
                      Say hi — this conversation is synced with Skiix messaging.
                      {peerSubtitle ? `\n@${peerSubtitle}` : ""}
                    </Text>
                  ) : null
                }
              />
            )}
          </View>

          {/* Composer */}
          <View className="border-t border-[#FFFFFF10] pb-4 pt-3 px-3 bg-black">
            <View className="flex-row items-end">
              <TouchableOpacity hitSlop={10} className="mr-3 mb-3 p-2" accessibilityLabel="Add attachment">
                <Ionicons name="add-circle" size={30} color="#00E5FF" />
              </TouchableOpacity>

              <View className="flex-1 mr-3">
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Type a message..."
                  placeholderTextColor="#6B7380"
                  multiline
                  style={{
                    minHeight: 44,
                    maxHeight: 120,
                    paddingHorizontal: 16,
                    paddingVertical: Platform.OS === "ios" ? 11 : 8,
                    borderRadius: 24,
                    backgroundColor: "#1E2228",
                    color: "#F1F5F9",
                    fontSize: 16,
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={send}
                disabled={!draft.trim() || sending}
                className="mb-3 w-11 h-11 rounded-[22px] items-center justify-center"
                style={{
                  backgroundColor: draft.trim() && !sending ? "#383C44" : "#2A2D33",
                  borderWidth: 1,
                  borderColor: "#FFFFFF12",
                  opacity: sending ? 0.6 : 1,
                }}
                accessibilityLabel="Send"
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={draft.trim() && !sending ? "#E2E8F0" : "#6B7380"}
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
