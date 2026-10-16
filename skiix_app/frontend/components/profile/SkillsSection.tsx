import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SectionHeader } from "./SectionHeader";

type Props = {
  skills: string[];
  /** Opens the bottom-sheet skill editor. */
  onEdit: () => void;
};

export function SkillsSection({ skills, onEdit }: Props) {
  return (
    <View style={styles.card}>
      <SectionHeader title="Core Skills" />

      <View style={styles.row}>
        {skills.length === 0 ? (
          <Text style={styles.empty}>
            Tap “Add Skills” to highlight what you bring to the table.
          </Text>
        ) : (
          skills.map((label) => (
            <View key={label} style={styles.chip}>
              <Text style={styles.chipText}>{label}</Text>
            </View>
          ))
        )}

        <Pressable onPress={onEdit} style={styles.addChip} hitSlop={6}>
          <Text style={styles.addText}>+ Add Skills</Text>
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
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  chip: {
    backgroundColor: "#1A1A1A",
    borderColor: "#2A2A2A",
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  empty: { color: "#FFFFFF55", fontSize: 12, lineHeight: 18, flex: 1 },
  addChip: {
    borderColor: "rgba(0,229,255,0.45)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addText: { color: "#00E5FF", fontSize: 14, fontWeight: "700" },
});
