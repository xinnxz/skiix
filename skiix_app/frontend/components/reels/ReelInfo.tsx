import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import type { ReelView } from "@/services/reelsService";
import { profilePathFromIds } from "@/utils/profileNav";

const TOKENS = {
  text: "#FFFFFF",
  textDim: "rgba(255,255,255,0.85)",
  cyan: "#00E5FF",
};

type Props = {
  reel: ReelView;
  onHashtagPress?: (tag: string) => void;
};

export function ReelInfo({ reel, onHashtagPress }: Props) {
  const hashtags = reel.hashtags;

  const openProfile = useCallback(() => {
    const href = profilePathFromIds(reel.user_id, reel.username);
    if (href) router.push(href);
  }, [reel.user_id, reel.username]);

  return (
    <View style={styles.wrap}>
      <View style={styles.userRow}>
        <TouchableOpacity
          onPress={openProfile}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`Open @${reel.username} profile`}
        >
          <Text style={styles.username} numberOfLines={1}>
            @{reel.username}
          </Text>
        </TouchableOpacity>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{reel.role_tag}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {reel.title}
      </Text>

      {reel.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {reel.description}
        </Text>
      ) : null}

      {hashtags.length > 0 ? (
        <Text style={styles.hashtags} numberOfLines={1}>
          {hashtags.map((tag, idx) => (
            <Text
              key={`${tag}-${idx}`}
              onPress={() => onHashtagPress?.(tag)}
              suppressHighlighting
            >
              {tag}
              {idx < hashtags.length - 1 ? " " : ""}
            </Text>
          ))}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    marginRight: 16,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    fontWeight: "600",
    color: TOKENS.text,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TOKENS.cyan,
    backgroundColor: "transparent",
  },
  badgeText: {
    color: TOKENS.cyan,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: TOKENS.text,
    marginTop: 6,
    lineHeight: 28,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },
  description: {
    fontSize: 14,
    color: TOKENS.textDim,
    marginTop: 6,
    lineHeight: 20,
  },
  hashtags: {
    fontSize: 13,
    color: TOKENS.cyan,
    fontWeight: "500",
    marginTop: 8,
  },
});
