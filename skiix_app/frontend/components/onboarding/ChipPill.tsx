import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: "sm" | "md";
};

/** Pill chip used for interests (sm) and core skills (md). */
export function ChipPill({ label, selected, onPress, size = "sm" }: Props) {
  const isMd = size === "md";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isMd ? styles.md : styles.sm,
        selected ? styles.selected : styles.unselected,
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text
        style={[
          isMd ? styles.textMd : styles.textSm,
          selected ? styles.textSelected : styles.textUnselected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    backgroundColor: "#1A1A1A",
  },
  sm: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  md: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
  unselected: { borderColor: "#2A2A2A" },
  selected: { borderColor: "#00E5FF", backgroundColor: "rgba(0,229,255,0.10)" },
  textSm: { fontSize: 13 },
  textMd: { fontSize: 14, fontWeight: "600" },
  textUnselected: { color: "#FFFFFF" },
  textSelected: { color: "#00E5FF" },
});
