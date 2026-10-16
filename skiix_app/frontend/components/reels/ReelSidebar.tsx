import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { Ionicons, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReelView } from "@/services/reelsService";
import { profilePathFromIds } from "@/utils/profileNav";

const TOKENS = {
  text: "#FFFFFF",
  cyan: "#00E5FF",
  redHeart: "#FF4D4D",
};

type Props = {
  reel: ReelView;
  onLike: () => void;
  onComment: () => void;
  onSave: () => void;
  onFollow: () => void;
  onShare: () => void;
  onAvatarPress?: () => void;
  onJoinProject?: () => void;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ReelSidebar({
  reel,
  onLike,
  onComment,
  onSave,
  onFollow,
  onShare,
  onAvatarPress,
  onJoinProject,
}: Props) {
  const heartScale = useSharedValue(1);

  const slug = reel.username?.trim() ?? "";
  const avatarUri = reel.avatar_url?.trim() ?? "";
  const initials = ((slug || reel.user_id || "U").slice(0, 2)).toUpperCase();

  const goProfile = useCallback(() => {
    if (onAvatarPress) {
      onAvatarPress();
      return;
    }
    const href = profilePathFromIds(reel.user_id, slug);
    if (href) router.push(href);
  }, [onAvatarPress, reel.user_id, slug]);

  const triggerHeartBump = useCallback(() => {
    heartScale.value = withSequence(
      withSpring(1.3, { damping: 4, mass: 0.4 }),
      withSpring(1, { damping: 6, mass: 0.5 }),
    );
  }, [heartScale]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleLike = () => {
    triggerHeartBump();
    onLike();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.avatarBlock}>
        <TouchableOpacity
          onPress={goProfile}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Open @${reel.username}'s profile`}
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </TouchableOpacity>
        {!reel.is_own_post ? (
          <TouchableOpacity
            onPress={onFollow}
            activeOpacity={0.85}
            style={[
              styles.followBadge,
              reel.is_following_author && styles.followBadgeDone,
            ]}
            hitSlop={8}
            accessibilityLabel={
              reel.is_following_author ? "Following" : "Follow"
            }
          >
            <Ionicons
              name={reel.is_following_author ? "checkmark" : "add"}
              size={14}
              color={reel.is_following_author ? TOKENS.cyan : "#000000"}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity onPress={handleLike} activeOpacity={0.85} style={styles.btn}>
        <Animated.View style={heartStyle}>
          <FontAwesome
            name="heart"
            size={28}
            color={reel.is_liked ? TOKENS.redHeart : TOKENS.text}
          />
        </Animated.View>
        <Text style={styles.count}>{formatCount(reel.likes_count)}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onComment} activeOpacity={0.85} style={styles.btn}>
        <Ionicons name="chatbubble" size={28} color={TOKENS.text} />
        <Text style={styles.count}>{formatCount(reel.comments_count)}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onSave} activeOpacity={0.85} style={styles.btn}>
        <FontAwesome
          name="bookmark"
          size={28}
          color={reel.is_saved ? TOKENS.cyan : TOKENS.text}
        />
        <Text style={styles.count}>{formatCount(reel.saves_count)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onShare}
        activeOpacity={0.85}
        style={styles.btn}
        accessibilityLabel="Share reel"
      >
        <Ionicons name="paper-plane-outline" size={28} color={TOKENS.text} />
      </TouchableOpacity>

      {reel.project_id ? (
        <TouchableOpacity
          onPress={onJoinProject}
          activeOpacity={0.85}
          style={styles.joinBtn}
          accessibilityLabel="Join project"
        >
          <MaterialCommunityIcons name="handshake" size={26} color="#000000" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 18,
  },
  avatarBlock: {
    marginBottom: 4,
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: TOKENS.cyan,
  },
  avatarFallback: {
    backgroundColor: "#1A2E35",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: "800",
    color: TOKENS.cyan,
  },
  followBadge: {
    position: "absolute",
    bottom: -6,
    left: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: TOKENS.cyan,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000000",
  },
  followBadgeDone: {
    backgroundColor: "#000000",
    borderColor: TOKENS.cyan,
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
  },
  count: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.text,
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 4,
  },
  joinBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: TOKENS.cyan,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TOKENS.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
