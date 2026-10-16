import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { toast } from "sonner-native";
import type { HomeFeedPost } from "@/types/homeFeed.types";
import { HomePostMedia } from "./HomePostMedia";
import { VibeSlider } from "./VibeSlider";
import { BookmarkActionSheet } from "./BookmarkActionSheet";
import { mvpFeaturesApi } from "@/utils/mvpFeatures.api";
import { trackAnalytics } from "@/utils/analytics";
import { togglePostLike } from "@/utils/feedInteractions.api";
import { projectsApi } from "@/utils/projects.api";
import { followApi } from "@/utils/follow.api";
import { formatRelativeTime } from "@/utils/format";
import { useAuth } from "@/store/auth.store";
import { useQueryClient } from "@tanstack/react-query";
import { homeFeedPostToDetailSeed, postDetailKeys } from "@/hooks/usePostDetail";

const CYAN = "#00E5FF";
const MUTED = "#888888";
const LIKE = "#FF4D4D";
const GREEN = "#22C55E";
const GOLD = "#F59E0B";

function parseMetricsJson(raw: string | null | undefined): { label: string; value: string }[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: { label: string; value: string }[] = [];
    for (const x of parsed) {
      if (x && typeof x === "object" && "label" in x && "value" in x) {
        const label = String((x as { label: unknown }).label ?? "").trim();
        const value = String((x as { value: unknown }).value ?? "").trim();
        if (label || value) out.push({ label, value });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function milestoneLabel(id: string | undefined | null) {
  if (!id) return "";
  const map: Record<string, string> = {
    launch: "🚀 Launch",
    funding: "💰 Funding",
    users: "👥 User milestone",
    feature: "⚡ New feature",
    revenue: "📈 Revenue",
    team: "🤝 Team update",
    pivot: "🔄 Pivot",
    custom: "🏁 Custom",
  };
  return map[id] || id;
}

type Props = {
  post: HomeFeedPost;
  viewerEmail: string;
  onPatchPost: (
    postId: string,
    patch: Partial<HomeFeedPost> | ((prev: HomeFeedPost) => Partial<HomeFeedPost>),
  ) => void;
};

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function HomeFeedPostCard({ post, viewerEmail, onPatchPost }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const qc = useQueryClient();
  const [ctaBusy, setCtaBusy] = useState(false);
  const scale = useSharedValue(1);
  const likedRef = useRef(post.is_liked);
  likedRef.current = post.is_liked;

  const handle = post.author_username?.trim() || post.author_email.split("@")[0] || "user";
  const profileSlug = post.author_username?.trim() || handle;
  const mine =
    !!viewerEmail &&
    (post.is_own_post === true ||
      post.author_email.toLowerCase() === viewerEmail.toLowerCase());
  const mediaUri = (post.media_url || post.image_url || "").trim();
  const attachmentType: "image" | "video" =
    post.media_type === "video" ? "video" : "image";

  const joinEligible =
    Boolean(post.project_id) &&
    (post.type === "project" ||
      (post.type === "project_update" && post.is_new_project === true));

  const badgeOnlyProjectUpdate =
    post.type === "project_update" &&
    Boolean(post.project_id) &&
    post.is_new_project !== true;

  const metricCards = parseMetricsJson(post.metrics);

  const joined = post.is_joined === true;
  const following = post.is_following === true;

  const avatarUri = useMemo(
    () =>
      `https://ui-avatars.com/api/?name=${encodeURIComponent(handle)}&background=0A0F12&color=70DAFF`,
    [handle],
  );

  const animatedHeart = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bumpHeart = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.35, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 10, stiffness: 320 }),
    );
  }, [scale]);

  const doLike = useCallback(async () => {
    if (!accessToken) {
      toast.error("Sign in to like posts.");
      return;
    }
    const nextLiked = !post.is_liked;
    const delta = nextLiked ? 1 : -1;
    onPatchPost(post.id, {
      is_liked: nextLiked,
      like_count: Math.max(0, (post.like_count ?? 0) + delta),
    });
    bumpHeart();
    try {
      const res = await togglePostLike(post.id);
      onPatchPost(post.id, {
        is_liked: res.is_liked,
        like_count: res.like_count ?? post.like_count,
      });
    } catch {
      onPatchPost(post.id, {
        is_liked: post.is_liked,
        like_count: post.like_count,
      });
      toast.error("Could not update like.");
    }
  }, [accessToken, post, onPatchPost, bumpHeart]);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (!likedRef.current) {
        runOnJS(doLike)();
      } else {
        runOnJS(bumpHeart)();
      }
    });

  const tapBookmark = useCallback(async () => {
    if (!accessToken) {
      toast.error("Sign in to save posts.");
      return;
    }
    const next = !post.is_saved;
    onPatchPost(post.id, {
      is_saved: next,
      saves_count: Math.max(0, (post.saves_count ?? 0) + (next ? 1 : -1)),
    });
    try {
      const res = await mvpFeaturesApi.toggleSave(post.id);
      onPatchPost(post.id, { is_saved: res.saved, saves_count: res.saves_count });
      void trackAnalytics("bookmark_save", { post_id: post.id });
    } catch {
      onPatchPost(post.id, { is_saved: post.is_saved, saves_count: post.saves_count });
      toast.error("Could not update bookmark.");
    }
  }, [accessToken, post, onPatchPost]);

  const openPostDetail = useCallback(
    (focusComments?: boolean) => {
      qc.setQueryData(postDetailKeys.detail(post.id), homeFeedPostToDetailSeed(post));
      router.push({
        pathname: "/posts/[id]",
        params: {
          id: post.id,
          ...(focusComments ? { focusComments: "1" } : {}),
        },
      });
    },
    [post, qc],
  );

  const openShareMenu = () => {
    const postUrl = `https://skiix.app/posts/${post.id}`;
    const run = async (idx: number) => {
      if (idx === 0) {
        await Clipboard.setStringAsync(postUrl);
        toast.success("Link copied ✓");
      } else if (idx === 1) {
        try {
          await Share.share({
            message: `Check this out on Skiix: ${postUrl}`,
          });
        } catch {
          /* dismissed */
        }
      } else if (idx === 2) {
        router.push({
          pathname: "/forward-post",
          params: { postId: post.id, preview: post.content?.slice(0, 120) ?? "" },
        });
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["📋 Copy Link", "📤 Share to…", "💬 Send in Skiix", "Cancel"],
          cancelButtonIndex: 3,
          userInterfaceStyle: "dark",
          tintColor: CYAN,
        },
        (i) => {
          if (i === undefined || i === 3) return;
          void run(i);
        },
      );
    } else {
      Alert.alert("Share Post", undefined, [
        { text: "📋 Copy Link", onPress: () => void run(0) },
        { text: "📤 Share to…", onPress: () => void run(1) },
        { text: "💬 Send in Skiix", onPress: () => void run(2) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const onJoinOrFollow = async () => {
    if (!viewerEmail || ctaBusy) return;
    setCtaBusy(true);
    try {
      if (joinEligible) {
        const projectId = (post.project_id || post.id) as string;
        onPatchPost(post.id, { is_joined: true });
        await projectsApi.join({ user_email: viewerEmail, project_id: projectId });
        toast.success("Joined project");
      } else {
        const toEmail = post.author_email.toLowerCase();
        if (!toEmail || toEmail === viewerEmail.toLowerCase()) return;
        onPatchPost(post.id, { is_following: true });
        await followApi.follow({ follower_email: viewerEmail, following_email: toEmail });
        toast.success("Following");
      }
    } catch {
      onPatchPost(post.id, {
        is_joined: post.is_joined,
        is_following: post.is_following,
      });
      toast.error("Action failed. Try again.");
    } finally {
      setCtaBusy(false);
    }
  };

  return (
    <View
      style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      className="mx-6 rounded-[32px] border border-[#FFFFFF1A] mb-4 overflow-hidden"
    >
      <Pressable onPress={() => openPostDetail()} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        <View className="p-5 pb-3">
          <View className="flex-row items-center mb-4">
            <Image
              source={{ uri: avatarUri }}
              style={{ width: 40, height: 40, borderRadius: 999 }}
              contentFit="cover"
            />
            <View className="ml-3 flex-1">
              <View className="flex-row items-center flex-wrap">
                <Text className="text-white font-spaceBold capitalize">{handle}</Text>
                {post.is_verified ? (
                  <MaterialCommunityIcons
                    name="check-decagram"
                    size={14}
                    color={CYAN}
                    style={{ marginLeft: 4 }}
                  />
                ) : null}
                <Text className="text-[#888888] text-xs ml-1 font-space">
                  · {formatRelativeTime(post.created_at)}
                </Text>
              </View>
            </View>
          </View>

          {post.content ? (
            <Text className="text-[#FFFFFFE5] font-space text-sm leading-6 mb-2">{post.content}</Text>
          ) : null}

          {post.tags && post.tags.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 mb-2">
              {post.tags.map((tag) => (
                <Text key={tag} className="text-[#00E5FF] font-space text-xs">
                  #{tag}
                </Text>
              ))}
            </View>
          ) : null}

          {post.milestone_type ? (
            <View
              className="self-start mb-2 px-3 py-1.5 rounded-lg border"
              style={{ borderColor: GOLD, backgroundColor: "rgba(245,158,11,0.08)" }}
            >
              <Text style={{ color: GOLD, fontSize: 12, fontWeight: "700" }}>
                {milestoneLabel(post.milestone_type)}
              </Text>
            </View>
          ) : null}

          {metricCards.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 mb-2">
              {metricCards.map((m, i) => (
                <View
                  key={`${m.label}-${i}`}
                  className="rounded-xl px-3 py-2 items-center min-w-[72px]"
                  style={{
                    borderWidth: 1,
                    borderColor: GREEN,
                    backgroundColor: "#0A2010",
                  }}
                >
                  <Text style={{ color: GREEN, fontSize: 16, fontWeight: "800" }}>{m.value}</Text>
                  <Text style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>{m.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {mediaUri ? (
            <HomePostMedia
              mediaUrl={mediaUri}
              mediaType={attachmentType}
              thumbnailUrl={post.thumbnail_url}
            />
          ) : null}

          {(post.extra_media_urls?.length ?? 0) > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: mediaUri ? 8 : 12 }}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            >
              {(post.extra_media_urls ?? []).map((extraUri) => (
                <Image
                  key={extraUri}
                  source={{ uri: extraUri }}
                  style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: "#1A1A1A" }}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
      </Pressable>

      <View className="px-5 pb-5">
        <GestureDetector gesture={doubleTap}>
          <View className="flex-row justify-between items-center mt-1">
            <View className="flex-row gap-5 items-center">
              <TouchableOpacity className="flex-row items-center" onPress={() => void doLike()}>
                <Animated.View style={animatedHeart}>
                  <Ionicons
                    name={post.is_liked ? "heart" : "heart-outline"}
                    size={22}
                    color={post.is_liked ? LIKE : MUTED}
                  />
                </Animated.View>
                <Text className="text-[#888888] text-xs ml-2 font-space">
                  {formatCount(post.like_count ?? 0)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-row items-center" onPress={() => openPostDetail(true)}>
                <Feather name="message-square" size={20} color={MUTED} />
                <Text className="text-[#888888] text-xs ml-2 font-space">
                  {formatCount(post.comment_count ?? 0)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={8} onPress={openShareMenu}>
                <Feather name="share-2" size={20} color={MUTED} />
              </TouchableOpacity>
              <TouchableOpacity
                hitSlop={8}
                onPress={() => void tapBookmark()}
                onLongPress={() => setBookmarkOpen(true)}
                delayLongPress={400}
              >
                <Ionicons
                  name={post.is_saved ? "bookmark" : "bookmark-outline"}
                  size={20}
                  color={post.is_saved ? CYAN : MUTED}
                />
              </TouchableOpacity>
            </View>

            {!mine ? (
              badgeOnlyProjectUpdate ? (
                <View
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border"
                  style={{ borderColor: GREEN, backgroundColor: "#0A2010" }}
                >
                  <Ionicons name="cube-outline" size={14} color={GREEN} />
                  <Text className="text-white font-spaceBold text-xs" numberOfLines={1}>
                    {post.project_name?.trim() || "Project"}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  disabled={ctaBusy || (joinEligible ? joined : following)}
                  onPress={() => void onJoinOrFollow()}
                  className={
                    joinEligible
                      ? "px-5 py-2.5 rounded-full border border-[#00E5FF55] bg-[#1A2E35]"
                      : "bg-[#00E5FF] px-5 py-2.5 rounded-full"
                  }
                  activeOpacity={0.85}
                >
                  <Text
                    className={
                      joinEligible
                        ? "text-[#00E5FF] font-spaceBold text-xs"
                        : "text-black font-spaceBold text-xs"
                    }
                  >
                    {ctaBusy
                      ? "…"
                      : joinEligible
                        ? joined
                          ? "✓ Joined"
                          : "Join Project"
                        : following
                          ? "Following"
                          : "Follow"}
                  </Text>
                </TouchableOpacity>
              )
            ) : null}
          </View>
        </GestureDetector>

        <VibeSlider post={post} onPatch={(patch) => onPatchPost(post.id, patch)} />

        <BookmarkActionSheet
          post={post}
          visible={bookmarkOpen}
          onClose={() => setBookmarkOpen(false)}
          onPatch={(patch) => onPatchPost(post.id, patch)}
        />
      </View>
    </View>
  );
}
