import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

type Props = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function SectionHeader({ title, actionLabel, onActionPress }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text style={styles.action}>{actionLabel} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#888888",
    textTransform: "uppercase",
  },
  action: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#00E5FF",
    textTransform: "uppercase",
  },
});
