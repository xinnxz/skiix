import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { roleById } from "@/constants/roles";

type Props = {
  /** Role id persisted on the user (e.g. "founder"). */
  value: string | null | undefined;
};

/** Renders nothing when the value isn't a known signup role. */
export function RoleTag({ value }: Props) {
  const role = roleById(value);
  if (!role) return null;
  return (
    <View style={styles.badge}>
      <Ionicons name={role.icon} size={12} color="#00E5FF" />
      <Text style={styles.badgeText}>{role.label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#00E5FF",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    backgroundColor: "transparent",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#00E5FF",
    letterSpacing: 1,
  },
});
