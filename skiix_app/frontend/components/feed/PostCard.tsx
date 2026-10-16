// ============================================================
// POST CARD COMPONENT
// ============================================================

import React, { memo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { PostDTO } from "@/types/post.types";
import { Colors, Typography, BorderRadius, Spacing } from "@/theme";
import { Avatar, Badge } from "@/components/common";
import { useTogglePostLike, useTogglePostBookmark } from "@/hooks/useFeed";
import { formatRelativeTime, formatCount } from "@/utils/format";
import { profilePathFromIds } from "@/utils/profileNav";

interface PostCardProps {
  post: PostDTO;
  onPress?: () => void;
  variant?: "feed" | "detail" | "compact";
}

export const PostCard = memo(function PostCard({
  post,
  onPress,
  variant = "feed",
}: PostCardProps) {
  const router = useRouter();
  const likeMutation = useTogglePostLike();
  const bookmarkMutation = useTogglePostBookmark();

  const handleLike = useCallback(() => {
    likeMutation.mutate({ id: post.id, liked: post.is_liked });
  }, [post.id, post.is_liked]);

  const handleBookmark = useCallback(() => {
    bookmarkMutation.mutate({ id: post.id, bookmarked: post.is_bookmarked });
  }, [post.id, post.is_bookmarked]);

  const handleProfilePress = useCallback(() => {
    const href = profilePathFromIds(post.author.id, post.author.username);
    if (href) router.push(href);
  }, [post.author.id, post.author.username, router]);

  const handlePress = useCallback(() => {
    onPress?.();
    router.push(`/post/${post.id}` as never);
  }, [post.id, onPress, router]);

  return (
    <View style={styles.container}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <TouchableOpacity onPress={handleProfilePress} style={styles.authorLeft} accessibilityRole="button">
          <Avatar
            uri={post.author.avatar_url}
            displayName={post.author.display_name}
            size={42}
            showBorder={post.author.is_verified}
          />
          <View style={styles.authorInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {post.author.display_name}
              </Text>
              {post.author.is_verified && (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={Colors.primary}
                />
              )}
              {post.author.investor_badge && (
                <Badge
                  label={post.author.investor_badge.tier.toUpperCase()}
                  variant="investor"
                  size="sm"
                />
              )}
            </View>
            <Text style={styles.usernameTime}>
              @{post.author.username} · {formatRelativeTime(post.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handlePress} activeOpacity={0.95}>
        {/* Content */}
        <Text style={styles.content}>{post.content}</Text>

        {/* Hashtags inline */}
        {post.hashtags.length > 0 && (
          <View style={styles.hashtagRow}>
            {post.hashtags.slice(0, 4).map((h) => (
              <TouchableOpacity key={h.tag}>
                <Text style={styles.hashtag}>#{h.tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Media grid */}
        {post.media.length > 0 && <MediaGrid media={post.media} />}

        {/* Quoted post */}
        {post.quoted_post && <QuotedPost post={post.quoted_post} />}
      </TouchableOpacity>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <ActionButton
          icon={post.is_liked ? "heart" : "heart-outline"}
          label={formatCount(post.like_count)}
          color={post.is_liked ? Colors.destructive : Colors.textMuted}
          onPress={handleLike}
        />
        <ActionButton
          icon="chatbubble-outline"
          label={formatCount(post.reply_count)}
          color={Colors.textMuted}
          onPress={handlePress}
        />
        <ActionButton
          icon="repeat-outline"
          label={formatCount(post.repost_count)}
          color={post.is_reposted ? Colors.success : Colors.textMuted}
          onPress={() => {}}
        />
        <ActionButton
          icon={post.is_bookmarked ? "bookmark" : "bookmark-outline"}
          label={formatCount(post.bookmark_count)}
          color={post.is_bookmarked ? Colors.primary : Colors.textMuted}
          onPress={handleBookmark}
        />
        <TouchableOpacity style={styles.shareBtn}>
          <Ionicons name="share-outline" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Sub-components ──────────────────────────────────────────

function ActionButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.actionBtn}
    >
      <Ionicons name={icon} size={19} color={color} />
      {label !== "0" && (
        <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function MediaGrid({ media }: { media: PostDTO["media"] }) {
  const count = media.length;
  if (count === 0) return null;

  const h = count === 1 ? 260 : 180;

  return (
    <View
      style={[
        styles.mediaGrid,
        count === 2 && { flexDirection: "row", gap: 3 },
        count >= 3 && { flexDirection: "row", flexWrap: "wrap", gap: 3 },
      ]}
    >
      {media.slice(0, 4).map((item, i) => (
        <View
          key={item.id}
          style={{
            width: count === 1 ? "100%" : count === 2 ? "49.5%" : "49.5%",
            height: h,
            borderRadius: BorderRadius.lg,
            overflow: "hidden",
            backgroundColor: Colors.surface3,
          }}
        >
          <Image
            source={{ uri: item.url }}
            style={{ width: "100%", height: "100%" }}
          />
          {i === 3 && count > 4 && (
            <View style={styles.moreOverlay}>
              <Text style={styles.moreText}>+{count - 4}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function QuotedPost({ post }: { post: PostDTO }) {
  return (
    <View style={styles.quotedContainer}>
      <View style={styles.quotedAuthorRow}>
        <Avatar
          uri={post.author.avatar_url}
          displayName={post.author.display_name}
          size={18}
        />
        <Text style={styles.quotedAuthorName}>{post.author.display_name}</Text>
        <Text style={styles.quotedUsername}>@{post.author.username}</Text>
      </View>
      <Text style={styles.quotedContent} numberOfLines={3}>
        {post.content}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    padding: Spacing.base,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  authorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  authorInfo: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  displayName: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  usernameTime: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    marginTop: 2,
  },
  moreButton: { padding: 4 },
  content: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    lineHeight: Typography.base * 1.55,
    marginBottom: 10,
  },
  hashtagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  hashtag: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: "500",
  },
  mediaGrid: {
    marginBottom: 10,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { color: "#fff", fontSize: Typography.xl, fontWeight: "700" },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    marginTop: 2,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, padding: 4 },
  actionLabel: { fontSize: Typography.sm, fontWeight: "500" },
  shareBtn: { padding: 4 },
  quotedContainer: {
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: BorderRadius.lg,
    padding: 12,
    marginBottom: 10,
    backgroundColor: Colors.surface2,
  },
  quotedAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  quotedAuthorName: {
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  quotedUsername: { color: Colors.textMuted, fontSize: Typography.xs },
  quotedContent: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    lineHeight: 18,
  },
});
