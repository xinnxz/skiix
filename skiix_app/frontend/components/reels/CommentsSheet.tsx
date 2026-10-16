import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { reelsService } from "@/services/reelsService";
import type { CommentDTO } from "@/types";

const TOKENS = {
  card: "#111111",
  border: "#1F1F1F",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
  bg: "#0A0A0A",
  inputBg: "#1A1A1A",
};

type Props = {
  visible: boolean;
  reelId: string | null;
  onClose: () => void;
  onCommentAdded?: (reelId: string) => void;
};

export function CommentsSheet({ visible, reelId, onClose, onCommentAdded }: Props) {
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !reelId) return;
    let alive = true;
    setLoading(true);
    setComments([]);
    reelsService
      .getComments(reelId)
      .then((res) => {
        if (alive) setComments(res.data ?? []);
      })
      .catch(() => {
        if (alive) setComments([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, reelId]);

  const submit = async () => {
    if (!reelId || !input.trim() || sending) return;
    setSending(true);
    try {
      const created = await reelsService.addComment(reelId, input.trim());
      setComments((prev) => [created, ...prev]);
      setInput("");
      onCommentAdded?.(reelId);
    } catch {
      toast.error("Couldn't post comment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
          style={styles.sheet}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Comments</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={TOKENS.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={TOKENS.cyan} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={32}
                    color="#333333"
                  />
                  <Text style={styles.emptyTitle}>Be the first to comment</Text>
                </View>
              }
              renderItem={({ item }) => <CommentRow comment={item} />}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            />
          )}

          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Add a comment…"
              placeholderTextColor="#666666"
              style={styles.input}
              multiline
            />
            <TouchableOpacity
              onPress={submit}
              disabled={!input.trim() || sending}
              style={[
                styles.sendBtn,
                { opacity: !input.trim() || sending ? 0.5 : 1 },
              ]}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#000000" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CommentRow({ comment }: { comment: CommentDTO }) {
  return (
    <View style={styles.commentRow}>
      <Image
        source={{
          uri:
            comment.author?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              comment.author?.username ?? "u",
            )}&background=0A0F12&color=70DAFF`,
        }}
        style={styles.commentAvatar}
        contentFit="cover"
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.commentAuthor} numberOfLines={1}>
          @{comment.author?.username ?? "user"}
        </Text>
        <Text style={styles.commentBody}>{comment.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: TOKENS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: "65%",
    maxHeight: "85%",
    borderTopWidth: 1,
    borderColor: TOKENS.border,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A2A",
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: TOKENS.border,
  },
  title: { color: TOKENS.text, fontSize: 16, fontWeight: "700" },
  loadingWrap: { paddingVertical: 48, alignItems: "center" },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 56,
    gap: 8,
  },
  emptyTitle: { color: TOKENS.textMuted, fontSize: 13 },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: TOKENS.border,
  },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentAuthor: { color: TOKENS.text, fontSize: 13, fontWeight: "600" },
  commentBody: { color: "rgba(255,255,255,0.85)", fontSize: 14, marginTop: 2 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.bg,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: TOKENS.inputBg,
    color: TOKENS.text,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TOKENS.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
});
