import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { toast } from "sonner-native";
import { useAuth } from "@/store/auth.store";
import type { PostDetailDTO } from "@/utils/postDetail.api";
import { projectsApi } from "@/utils/projects.api";
import { followApi } from "@/utils/follow.api";
import { cleanHandle, displayFullName } from "@/utils/displayIdentity";
import {
  usePatchPostDetail,
  usePostDetail,
  useTogglePostDetailLike,
} from "@/hooks/usePostDetail";
import { PostCommentsSection } from "@/components/posts/PostCommentsSection";
import { VibeSlider } from "@/components/feed/home/VibeSlider";
import { BookmarkActionSheet } from "@/components/feed/home/BookmarkActionSheet";
import { mvpFeaturesApi } from "@/utils/mvpFeatures.api";
import type { HomeFeedPost } from "@/types/homeFeed.types";
import { profilePathFromIds } from "@/utils/profileNav";

const SCREEN_W = Dimensions.get("window").width;
const CYAN = "#00E5FF";

function parseMetrics(raw?: string) {
  if (!raw?.trim()) return [] as { label: string; value: string }[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((m) => {
        if (m && typeof m === "object") {
          const o = m as Record<string, unknown>;
          return {
            label: String(o.label ?? ""),
            value: String(o.value ?? ""),
          };
        }
        return null;
      })
      .filter((x): x is { label: string; value: string } => Boolean(x?.label || x?.value));
  } catch {
    return [];
  }
}

function detailAsFeedPost(d: PostDetailDTO): HomeFeedPost {
  return {
    id: d.id,
    user_id: d.user_id,
    content: d.content,
    media_url: d.media_url,
    image_url: d.media_url,
    type: (d.type as HomeFeedPost["type"]) ?? "text",
    project_id: d.project_id,
    project_name: d.project_name,
    is_new_project: d.is_new_project,
    metrics: d.metrics,
    like_count: d.likes_count,
    comment_count: d.comments_count,
    created_at: d.created_at,
    updated_at: d.created_at,
    author_email: "",
    author_username: d.username,
    is_verified: d.is_verified,
    is_own_post: d.is_own_post,
    is_liked: d.is_liked,
    is_saved: d.is_saved,
    is_joined: d.is_joined,
    is_following: d.is_following,
    media_type: d.media_type,
    thumbnail_url: d.thumbnail_url,
    tags: d.tags,
    extra_media_urls: d.extra_media_urls,
    viewer_vibe_score: d.viewer_vibe_score,
    vibe_love_pct: d.vibe_love_pct,
    vibe_neutral_pct: d.vibe_neutral_pct,
    vibe_disagree_pct: d.vibe_disagree_pct,
    avg_vibe_score: d.avg_vibe_score,
    vibe_count: d.vibe_count,
    saves_count: d.saves_count,
  };
}

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    focusComments?: string | string[];
  }>();
  const postId = Array.isArray(params.id) ? params.id[0] : params.id;
  const focusComments = Array.isArray(params.focusComments)
    ? params.focusComments[0]
    : params.focusComments;

  const { user } = useAuth();
  const email = user?.email ?? "";
  const scrollRef = useRef<ScrollView>(null);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [followingBusy, setFollowingBusy] = useState(false);
  const videoRef = useRef<Video>(null);

  const { data: post, isLoading, isError } = usePostDetail(postId ?? "");
  const patchDetail = usePatchPostDetail(postId ?? "");
  const likeMutation = useTogglePostDetailLike(postId ?? "");

  const handle = cleanHandle(post?.username ?? "");
  const displayName = displayFullName(post?.full_name, handle);
  const metrics = useMemo(() => parseMetrics(post?.metrics), [post?.metrics]);
  const feedShape = useMemo(() => (post ? detailAsFeedPost(post) : null), [post]);

  const isReel = post?.type === "reel";
  const isProject =
    post?.type === "project" || (post?.type === "project_update" && post?.is_new_project);
  const joinEligible = Boolean(post?.project_id) && isProject && !post?.is_own_post;

  const openProfile = useCallback(() => {
    const href = profilePathFromIds(post?.user_id, handle);
    if (href) router.push(href);
  }, [post?.user_id, handle]);

  const openShare = useCallback(() => {
    if (!postId) return;
    const url = `https://skiix.app/posts/${postId}`;
    const run = async (idx: number) => {
      if (idx === 0) {
        await Clipboard.setStringAsync(url);
        toast.success("Link copied");
      } else if (idx === 1) {
        try {
          await Share.share({ message: `Check this on Skiix: ${url}` });
        } catch {
          /* dismissed */
        }
      }
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Copy link", "Share", "Cancel"], cancelButtonIndex: 2 },
        (i) => {
          if (i !== undefined && i < 2) void run(i);
        },
      );
    } else {
      Alert.alert("Share", undefined, [
        { text: "Copy link", onPress: () => void run(0) },
        { text: "Share", onPress: () => void run(1) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [postId]);

  const handleJoin = async () => {
    const pid = post?.project_id;
    if (!pid || !email || joining || post?.is_joined) return;
    setJoining(true);
    patchDetail({ is_joined: true });
    try {
      await projectsApi.join({ user_email: email.toLowerCase(), project_id: pid });
      toast.success("Joined project");
    } catch {
      patchDetail({ is_joined: false });
      toast.error("Could not join project.");
    } finally {
      setJoining(false);
    }
  };

  const handleFollow = async () => {
    if (!post || !user?.id || post.is_own_post || post.is_following || followingBusy) return;
    setFollowingBusy(true);
    patchDetail({ is_following: true });
    try {
      await followApi.followByIds({ follower_id: user.id, following_id: post.user_id });
      toast.success("Following");
    } catch {
      patchDetail({ is_following: false });
      toast.error("Follow failed.");
    } finally {
      setFollowingBusy(false);
    }
  };

  const toggleBookmark = async () => {
    if (!postId) return;
    const next = !post?.is_saved;
    patchDetail({ is_saved: next });
    try {
      const res = await mvpFeaturesApi.toggleSave(postId);
      patchDetail({ is_saved: res.saved, saves_count: res.saves_count });
    } catch {
      patchDetail({ is_saved: post?.is_saved });
      toast.error("Bookmark failed.");
    }
  };

  const headerTitle = useMemo(() => {
    if (!post) return "Post";
    if (post.type === "reel") return "Reel";
    if (post.type === "project") return "Project";
    if (post.type === "project_update") return "Project Update";
    if (post.type === "story") return "Story";
    return "Post";
  }, [post]);

  React.useEffect(() => {
    if (focusComments === "1" && post && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 400);
    }
  }, [focusComments, post]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <TouchableOpacity onPress={openShare} hitSlop={12}>
          <Ionicons name="share-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading && !post ? (
        <View style={styles.center}>
          <ActivityIndicator color={CYAN} size="large" />
        </View>
      ) : isError || !post ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Post not found</Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.authorRow} onPress={openProfile} activeOpacity={0.85}>
            {post.avatar_url ? (
              <Image source={{ uri: post.avatar_url }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{(handle || "U").slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.authorName}>{displayName}</Text>
                {post.is_verified ? (
                  <MaterialCommunityIcons name="check-decagram" size={16} color={CYAN} />
                ) : null}
              </View>
              {handle ? <Text style={styles.authorUsername}>@{handle}</Text> : null}
            </View>
            {!post.is_own_post ? (
              <TouchableOpacity
                style={[styles.followBtn, post.is_following && styles.followingBtn]}
                onPress={() => void handleFollow()}
                disabled={followingBusy || post.is_following}
              >
                <Text style={[styles.followBtnText, post.is_following && styles.followingBtnText]}>
                  {post.is_following ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>

          {post.content ? <Text style={styles.content}>{post.content}</Text> : null}

          {post.tags?.length > 0 ? (
            <View style={styles.tagsRow}>
              {post.tags.map((tag) => (
                <Text key={tag} style={styles.tag}>
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </Text>
              ))}
            </View>
          ) : null}

          {isReel && post.media_url ? (
            <View style={styles.reelContainer}>
              <Video
                ref={videoRef}
                source={{ uri: post.media_url }}
                style={styles.reelVideo}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay
                isLooping
                posterSource={post.thumbnail_url ? { uri: post.thumbnail_url } : undefined}
              />
            </View>
          ) : post.media_url && post.media_type === "video" ? (
            <View style={styles.videoWrap}>
              <Video
                source={{ uri: post.media_url }}
                style={styles.videoPlayer}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay={false}
                posterSource={post.thumbnail_url ? { uri: post.thumbnail_url } : undefined}
              />
            </View>
          ) : post.media_url ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/media-viewer",
                  params: {
                    uri: encodeURIComponent(post.media_url),
                    type: "image",
                    username: encodeURIComponent(handle),
                    caption: encodeURIComponent(post.content ?? ""),
                  },
                })
              }
            >
              <Image source={{ uri: post.media_url }} style={styles.postImage} contentFit="cover" />
              <View style={styles.zoomHint}>
                <Ionicons name="expand-outline" size={18} color="#fff" />
                <Text style={styles.zoomHintText}>Tap to zoom</Text>
              </View>
            </Pressable>
          ) : null}

          {(post.extra_media_urls?.length ?? 0) > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
              {(post.extra_media_urls ?? []).map((uri) => (
                <Pressable
                  key={uri}
                  onPress={() =>
                    router.push({
                      pathname: "/media-viewer",
                      params: {
                        uri: encodeURIComponent(uri),
                        type: "image",
                        username: encodeURIComponent(handle),
                      },
                    })
                  }
                >
                  <Image source={{ uri }} style={styles.galleryImage} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {post.project_id && (post.project_name || post.type === "project") ? (
            <View style={styles.projectCard}>
              <View style={styles.projectCardHeader}>
                <Ionicons name="rocket-outline" size={22} color={CYAN} />
                <Text style={styles.projectCardTitle}>{post.project_name || "Startup Project"}</Text>
              </View>
              <Text style={styles.projectCardDesc} numberOfLines={3}>
                {post.content || "Join this project on Skiix."}
              </Text>
              <TouchableOpacity
                style={styles.projectLink}
                onPress={() => router.push(`/projects/${post.project_id}` as never)}
              >
                <Text style={styles.projectLinkText}>View project page</Text>
                <Ionicons name="chevron-forward" size={16} color={CYAN} />
              </TouchableOpacity>
              {joinEligible ? (
                <TouchableOpacity
                  style={[styles.joinBtn, post.is_joined && styles.joinedBtn]}
                  onPress={() => void handleJoin()}
                  disabled={joining || post.is_joined}
                >
                  <Text style={[styles.joinBtnText, post.is_joined && styles.joinedBtnText]}>
                    {joining ? "Joining…" : post.is_joined ? "✓ Joined" : "Join Project"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {metrics.length > 0 ? (
            <View style={styles.metricsBox}>
              {metrics.map((m, i) => (
                <View key={`${m.label}-${i}`} style={styles.metricCard}>
                  <Text style={styles.metricValue}>{m.value}</Text>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => likeMutation.mutate()}>
              <Ionicons
                name={post.is_liked ? "heart" : "heart-outline"}
                size={26}
                color={post.is_liked ? "#FF4D4D" : "#888"}
              />
              <Text style={styles.actionCount}>{post.likes_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#888" />
              <Text style={styles.actionCount}>{post.comments_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={openShare}>
              <Ionicons name="share-social-outline" size={24} color="#888" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => void toggleBookmark()}
              onLongPress={() => setBookmarkOpen(true)}
              delayLongPress={400}
            >
              <Ionicons
                name={post.is_saved ? "bookmark" : "bookmark-outline"}
                size={24}
                color={post.is_saved ? CYAN : "#888"}
              />
            </TouchableOpacity>
          </View>

          {feedShape ? (
            <View style={styles.vibeWrap}>
              <VibeSlider
                post={feedShape}
                onPatch={(patch) => patchDetail(patch as Partial<PostDetailDTO>)}
              />
            </View>
          ) : null}

          <Text style={styles.timeText}>
            {new Date(post.created_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Text>

          <PostCommentsSection
            postId={post.id}
            totalCount={post.comments_count}
            onCountChange={(n) => patchDetail({ comments_count: n })}
          />

          <View style={{ height: 48 }} />
        </ScrollView>
      )}

      {feedShape ? (
        <BookmarkActionSheet
          post={feedShape}
          visible={bookmarkOpen}
          onClose={() => setBookmarkOpen(false)}
          onPatch={(patch) => patchDetail(patch as Partial<PostDetailDTO>)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#888", fontSize: 16 },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 999 },
  avatarFallback: { backgroundColor: "#1A3A4A", alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: CYAN, fontSize: 15, fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  authorName: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  authorUsername: { fontSize: 13, color: "#888", marginTop: 2 },
  followBtn: {
    backgroundColor: CYAN,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  followingBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#444" },
  followBtnText: { color: "#000", fontWeight: "700", fontSize: 12 },
  followingBtnText: { color: "#FFF" },
  content: {
    fontSize: 17,
    color: "#FFF",
    lineHeight: 26,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  tag: { color: CYAN, fontSize: 14 },
  postImage: { width: SCREEN_W, height: SCREEN_W * 0.85, marginBottom: 8 },
  zoomHint: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  zoomHintText: { color: "#fff", fontSize: 11 },
  reelContainer: { width: SCREEN_W, height: SCREEN_W * 1.35, backgroundColor: "#000" },
  reelVideo: { width: "100%", height: "100%" },
  videoWrap: { width: SCREEN_W, height: 240, backgroundColor: "#111", marginBottom: 8 },
  videoPlayer: { width: "100%", height: "100%" },
  gallery: { paddingHorizontal: 16, marginBottom: 12 },
  galleryImage: { width: 120, height: 120, borderRadius: 12, marginRight: 8 },
  projectCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#00E5FF33",
    backgroundColor: "#0A1A20",
  },
  projectCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  projectCardTitle: { color: "#FFF", fontSize: 17, fontWeight: "800", flex: 1 },
  projectCardDesc: { color: "#AAA", fontSize: 14, lineHeight: 20, marginBottom: 12 },
  projectLink: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 },
  projectLinkText: { color: CYAN, fontSize: 13, fontWeight: "600" },
  joinBtn: {
    backgroundColor: CYAN,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  joinedBtn: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "#22C55E" },
  joinBtnText: { color: "#000", fontWeight: "800", fontSize: 15 },
  joinedBtnText: { color: "#22C55E" },
  metricsBox: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  metricCard: {
    backgroundColor: "#0A2010",
    borderRadius: 10,
    padding: 12,
    minWidth: 72,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  metricValue: { color: "#22C55E", fontSize: 18, fontWeight: "800" },
  metricLabel: { color: "#888", fontSize: 11, marginTop: 2 },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { color: "#888", fontSize: 14 },
  vibeWrap: { marginHorizontal: 16, marginBottom: 8 },
  timeText: { color: "#555", fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },
});
