import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { useAuth } from "@/store/auth.store";
import { storiesApi, type StoryRingBucketDTO } from "@/utils/stories.api";
import { formatRelativeTime } from "@/utils/format";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { toast } from "sonner-native";

const DURATION_MS = 5000;

export default function StoryViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user, authUser, session } = useAuth();
  const email = user?.email ?? "";
  const meId = (user?.id ?? authUser?.id ?? session?.user?.id ?? "").trim();

  const [bucket, setBucket] = useState<StoryRingBucketDTO | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const progress = useSharedValue(0);

  const stories = bucket?.stories ?? [];
  const story = stories[currentIndex];

  const load = useCallback(async () => {
    if (!email || !userId) {
      setBucket(null);
      return;
    }
    try {
      const rings = await storiesApi.feedRing(email);
      const b = rings.find((r) => r.user_id === userId) ?? null;
      setBucket(b);
      setCurrentIndex(0);
    } catch {
      setBucket(null);
    }
  }, [email, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = useCallback(() => {
    router.back();
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => {
      if (i < stories.length - 1) return i + 1;
      setTimeout(close, 0);
      return i;
    });
  }, [stories.length, close]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  useEffect(() => {
    if (!story?.id || !email) return;
    void storiesApi.markSeen(email, story.id);
  }, [story?.id, email]);

  useEffect(() => {
    if (!story) return;
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: DURATION_MS, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(goNext)();
      },
    );
  }, [currentIndex, story?.id, progress, goNext]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const handle = bucket?.username ?? "story";
  const avatar = bucket?.avatar_url;
  const storyTime = story?.created_at || story?.expires_at;

  const recipientId = bucket?.user_id?.trim() ?? "";
  const canReply =
    !!session?.access_token &&
    !!recipientId &&
    !!meId &&
    recipientId !== meId;

  const handleStoryReply = async () => {
    const text = replyText.trim();
    if (!text || replySending || !canReply) return;
    setReplySending(true);
    setReplyText("");
    Keyboard.dismiss();

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${session!.access_token}`,
    };

    try {
      const base = getApiBaseUrl();
      if (!base) throw new Error("no api url");

      const convRes = await fetch(`${base}/api/v1/conversations`, {
        method: "POST",
        headers,
        body: JSON.stringify({ recipient_id: recipientId }),
      });
      const convJson = (await convRes.json().catch(() => ({}))) as {
        data?: { id?: string; conversation_id?: string };
      };
      const convId =
        convJson?.data?.id?.trim?.() || convJson?.data?.conversation_id?.trim?.() || "";
      if (!convRes.ok || !convId) throw new Error("conversation failed");

      const msgRes = await fetch(`${base}/api/v1/conversations/${encodeURIComponent(convId)}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: `Replied to your story: "${text}"`,
          message_type: "text",
        }),
      });
      if (!msgRes.ok) throw new Error("message failed");

      toast.success("Reply sent ✓");
    } catch {
      setReplyText(text);
      toast.error("Failed to send reply");
    } finally {
      setReplySending(false);
    }
  };

  if (!email || !userId) {
    return (
      <View style={styles.fill}>
        <SafeAreaView style={styles.top}>
          <TouchableOpacity onPress={close} style={styles.closeHit}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (!bucket || stories.length === 0) {
    return (
      <View style={styles.fill}>
        <SafeAreaView style={styles.top}>
          <TouchableOpacity onPress={close} style={styles.closeHit}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.muted}>No stories to show.</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.progressRow}>
        {stories.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            {i < currentIndex ? (
              <View style={[styles.progressFill, { width: "100%" }]} />
            ) : i === currentIndex ? (
              <Animated.View style={[styles.progressFill, barStyle]} />
            ) : null}
          </View>
        ))}
      </View>

      <SafeAreaView edges={["top"]} style={styles.header}>
        <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
        <Text style={styles.user}>@{handle}</Text>
        <Text style={styles.time}>{storyTime ? formatRelativeTime(storyTime) : ""}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={close} hitSlop={12}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.mediaWrap}>
        {story?.media_type === "video" ? (
          <Video
            key={story.id}
            source={{ uri: story.media_url }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping={false}
            onPlaybackStatusUpdate={(s) => {
              if (s.isLoaded && "didJustFinish" in s && s.didJustFinish) goNext();
            }}
          />
        ) : (
          <Image
            key={story?.id}
            source={{ uri: story?.media_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        )}

        <View style={styles.tapZones} pointerEvents="box-none">
          <Pressable style={{ flex: 1 }} onPress={goPrev} />
          <Pressable style={{ flex: 1 }} onPress={goNext} />
        </View>
      </View>

      <SafeAreaView edges={["bottom"]} style={styles.bottom}>
        <View style={styles.storyReplyBar}>
          <TextInput
            style={styles.storyReplyInput}
            placeholder={
              !recipientId
                ? "Replies unavailable"
                : recipientId === meId
                  ? "Your story"
                  : `Reply to @${handle}…`
            }
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={replyText}
            onChangeText={setReplyText}
            onSubmitEditing={() => void handleStoryReply()}
            returnKeyType="send"
            editable={canReply && !replySending}
          />
          <TouchableOpacity
            onPress={() => void handleStoryReply()}
            disabled={!canReply || replySending || !replyText.trim()}
            hitSlop={12}
          >
            {replySending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  top: { padding: 16 },
  closeHit: { alignSelf: "flex-start" },
  muted: { color: "#888", marginTop: 24, textAlign: "center" },
  progressRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 52,
  },
  progressTrack: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: 2,
    backgroundColor: "#FFF",
    borderRadius: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  avatar: { width: 36, height: 36, borderRadius: 999 },
  user: { color: "#FFF", fontWeight: "700" },
  time: { color: "#888", fontSize: 12 },
  mediaWrap: { flex: 1, backgroundColor: "#000" },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  bottom: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  storyReplyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  storyReplyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
});
