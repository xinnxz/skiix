import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

type Props = {
  posts: number;
  followers: number;
  projects: number;
  onPostsPress?: () => void;
  onFollowersPress?: () => void;
  onProjectsPress?: () => void;
};

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function Stat({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={styles.value}>{compact(value)}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export function StatsRow({
  posts,
  followers,
  projects,
  onPostsPress,
  onFollowersPress,
  onProjectsPress,
}: Props) {
  return (
    <View style={styles.row}>
      <Stat value={posts} label="Posts" onPress={onPostsPress} />
      <View style={styles.divider} />
      <Stat value={followers} label="Followers" onPress={onFollowersPress} />
      <View style={styles.divider} />
      <Stat value={projects} label="Projects" onPress={onProjectsPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 14,
  },
  cell: { flex: 1, alignItems: "center" },
  divider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.08)" },
  value: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  label: { color: "#888888", fontSize: 12, marginTop: 2 },
});
