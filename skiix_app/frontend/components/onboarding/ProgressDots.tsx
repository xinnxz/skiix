import React from "react";
import { View, StyleSheet } from "react-native";

type Props = {
  total: number;
  current: number; // 1-based
};

/** Tiny pill-dot row used across the four onboarding steps. */
export function ProgressDots({ total, current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, idx) => {
        const active = idx + 1 <= current;
        return (
          <View
            key={idx}
            style={[
              styles.dot,
              active ? styles.dotActive : styles.dotInactive,
              idx === current - 1 && styles.dotCurrent,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  dotInactive: { width: 8, backgroundColor: "#2A2A2A" },
  dotActive: { width: 8, backgroundColor: "#00E5FF" },
  dotCurrent: { width: 24 },
});
