import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import {
  createPostComment,
  fetchPostComments,
  type ApiPostComment,
} from "@/utils/feedInteractions.api";
import { formatRelativeTime } from "@/utils/format";

type Props = {
  postId: string;
  visible: boolean;
  onClose: () => void;
  /** Called after a comment is successfully persisted (for feed-count bumps). */
  onCommentPosted?: () => void;
};

export function HomeCommentsSheet({ postId, visible, onClose, onCommentPosted }: Props) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<ApiPostComment[]>([]);
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const rows = await fetchPostComments(postId);
      setItems([...rows].reverse());
    } catch {
      setItems([]);
      toast.error("Could not load comments.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (visible) {
      void load();
      setText("");
    }
  }, [visible, load]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const optimistic: ApiPostComment = {
      id: `tmp-${Date.now()}`,
      post_id: postId,
      user_id: "me",
      content: t,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author_username: "you",
      author_display_name: "You",
    };
    setItems((prev) => [optimistic, ...prev]);
    setText("");
    try {
      const created = await createPostComment(postId, t);
      setItems((prev) => {
        const rest = prev.filter((c) => c.id !== optimistic.id);
        return [created, ...rest];
      });
      onCommentPosted?.();
    } catch {
      setItems((prev) => prev.filter((c) => c.id !== optimistic.id));
      setText(t);
      toast.error("Could not send comment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/70"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView edges={["bottom"]} className="mt-auto max-h-[85%] rounded-t-3xl bg-[#111111]">
          <View className="flex-row items-center justify-between border-b border-[#1F1F1F] px-4 py-3">
            <Text className="text-white font-spaceBold text-base">Comments ({items.length})</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color="#00E5FF" />
            </View>
          ) : (
            <FlatList
              data={items}
	keyExtractor={(c) => c.id || `row-${c.created_at}-${c.user_id}`}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
              renderItem={({ item }) => {
                const name =
                  item.author_display_name?.trim() ||
                  item.author_username?.trim() ||
                  item.username?.trim() ||
                  "Member";
                const handleRaw = item.author_username?.trim() || item.username?.trim();
                const handle = handleRaw ? `@${handleRaw}` : "";
                const avatar =
                  item.author_avatar_url?.trim() ||
                  item.avatar_url?.trim() ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0A0F12&color=70DAFF&size=128`;
                return (
                  <View className="flex-row py-3 border-b border-[#1F1F1F]">
                    <Image
                      source={{ uri: avatar }}
                      style={{ width: 36, height: 36, borderRadius: 999 }}
                      contentFit="cover"
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-spaceBold text-sm">
                        {name}{" "}
                        {handle ? (
                          <Text className="text-[#888888] font-space text-xs">{handle}</Text>
                        ) : null}
                      </Text>
                      <Text className="text-white font-space text-sm mt-1 leading-5">{item.content}</Text>
                      <Text className="text-[#888888] text-[11px] mt-1 font-space">
                        {formatRelativeTime(item.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text className="text-[#888888] font-space text-sm py-6 text-center">No comments yet.</Text>
              }
            />
          )}

          <View className="flex-row items-center gap-2 border-t border-[#1F1F1F] px-3 py-2 pb-4">
            <TextInput
              className="flex-1 rounded-full bg-[#1A1A1A] px-4 py-3 text-white font-space text-sm"
              placeholder="Write a comment…"
              placeholderTextColor="#888888"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={() => void send()}
              disabled={!text.trim() || sending}
              className="h-11 w-11 rounded-full bg-[#00E5FF] items-center justify-center opacity-100 disabled:opacity-40"
            >
              {sending ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#000" />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
