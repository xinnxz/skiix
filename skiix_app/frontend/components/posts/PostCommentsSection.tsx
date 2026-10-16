import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import {
  createPostComment,
  deletePostComment,
  fetchPostComments,
  type ApiPostComment,
} from "@/utils/feedInteractions.api";
import { formatRelativeTime } from "@/utils/format";
import { useAuth } from "@/store/auth.store";

const PAGE = 20;

type Props = {
  postId: string;
  totalCount?: number;
  onCountChange?: (n: number) => void;
};

export function PostCommentsSection({ postId, totalCount = 0, onCountChange }: Props) {
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const [items, setItems] = useState<ApiPostComment[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const loadPage = useCallback(
    async (nextOffset: number, append: boolean) => {
      if (!postId) return;
      if (nextOffset === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const rows = await fetchPostComments(postId, PAGE, nextOffset);
        setItems((prev) => (append ? [...prev, ...rows] : rows));
        setHasMore(rows.length >= PAGE);
        setOffset(nextOffset + rows.length);
      } catch {
        if (!append) setItems([]);
        toast.error("Could not load comments.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const optimistic: ApiPostComment = {
      id: `tmp-${Date.now()}`,
      post_id: postId,
      user_id: meId || "me",
      content: t,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author_username: "you",
      author_display_name: "You",
    };
    setItems((prev) => [optimistic, ...prev]);
    setText("");
    onCountChange?.(totalCount + 1);
    try {
      const created = await createPostComment(postId, t);
      setItems((prev) => [created, ...prev.filter((c) => c.id !== optimistic.id)]);
    } catch {
      setItems((prev) => prev.filter((c) => c.id !== optimistic.id));
      setText(t);
      onCountChange?.(totalCount);
      toast.error("Could not send comment.");
    } finally {
      setSending(false);
    }
  };

  const remove = (comment: ApiPostComment) => {
    Alert.alert("Delete comment?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePostComment(postId, comment.id);
            setItems((prev) => prev.filter((c) => c.id !== comment.id));
            onCountChange?.(Math.max(0, totalCount - 1));
          } catch {
            toast.error("Could not delete comment.");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: ApiPostComment }) => {
    const name =
      item.author_display_name?.trim() ||
      item.author_username?.trim() ||
      item.username?.trim() ||
      "Member";
    const handleRaw = item.author_username?.trim() || item.username?.trim();
    const avatar =
      item.author_avatar_url?.trim() ||
      item.avatar_url?.trim() ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0A0F12&color=70DAFF`;
    const mine = item.user_id === meId;

    return (
      <View className="flex-row py-3 border-b border-[#1F1F1F]">
        <Image source={{ uri: avatar }} style={{ width: 36, height: 36, borderRadius: 999 }} />
        <View className="ml-3 flex-1">
          <View className="flex-row justify-between items-start">
            <Text className="text-white font-spaceBold text-sm flex-1">
              {name}
              {handleRaw ? (
                <Text className="text-[#888] font-space text-xs"> @{handleRaw}</Text>
              ) : null}
            </Text>
            {mine ? (
              <TouchableOpacity onPress={() => remove(item)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text className="text-white font-space text-sm mt-1 leading-5">{item.content}</Text>
          <Text className="text-[#888] text-[11px] mt-1">{formatRelativeTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View className="px-4 pt-4 border-t border-[#1F1F1F]">
      <Text className="text-white font-spaceBold text-base mb-3">
        Comments ({Math.max(totalCount, items.length)})
      </Text>

      <View className="flex-row items-center gap-2 mb-4">
        <TextInput
          className="flex-1 rounded-full bg-[#1A1A1A] px-4 py-3 text-white font-space text-sm"
          placeholder="Add a comment…"
          placeholderTextColor="#888"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          onPress={() => void send()}
          disabled={!text.trim() || sending}
          className="h-11 w-11 rounded-full bg-[#00E5FF] items-center justify-center disabled:opacity-40"
        >
          {sending ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#000" />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#00E5FF" className="py-8" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text className="text-[#888] text-center py-6 font-space">No comments yet — start the thread.</Text>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                className="py-4 items-center"
                onPress={() => void loadPage(offset, true)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator color="#00E5FF" />
                ) : (
                  <Text className="text-[#00E5FF] font-spaceBold text-sm">Load more comments</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}
