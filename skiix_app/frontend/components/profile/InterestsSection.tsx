import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SectionHeader } from "./SectionHeader";
import { formatInterestTag } from "@/constants/interests";

type Props = {
  interests: string[];
  /** Opens the bottom-sheet interest editor. */
  onEdit: () => void;
};

const MAX_VISIBLE = 5;

export function InterestsSection({ interests, onEdit }: Props) {
  const visible = interests.slice(0, MAX_VISIBLE);

  return (
    <View style={styles.card}>
      <SectionHeader title="Interests" actionLabel="Personalize" onActionPress={onEdit} />

      <View style={styles.row}>
        {visible.length === 0 ? (
          <Text style={styles.empty}>
            Tap Personalize to choose topics for your feed.
          </Text>
        ) : (
          visible.map((id) => (
            <View key={id} style={styles.chip}>
              <Text style={styles.chipText}>{formatInterestTag(id)}</Text>
            </View>
          ))
        )}

        <Pressable onPress={onEdit} style={styles.exploreChip} hitSlop={6}>
          <Text style={styles.exploreText}>+ Explore More</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 18,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: {
    backgroundColor: "#1A1A1A",
    borderColor: "#2A2A2A",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: "#FFFFFF", fontSize: 13 },
  empty: { color: "#FFFFFF55", fontSize: 12, lineHeight: 18, flex: 1 },
  exploreChip: {
    borderColor: "rgba(0,229,255,0.45)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  exploreText: { color: "#00E5FF", fontSize: 13, fontWeight: "600" },
});
