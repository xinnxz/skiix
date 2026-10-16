import React from "react";
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from "react-native";
import {
  EXPLORE_CATEGORIES,
  type ExploreCategoryId,
} from "@/services/exploreService";

const TOKENS = {
  active: "#00E5FF",
  inactive: "#111111",
  border: "#1F1F1F",
  text: "#FFFFFF",
  textActive: "#000000",
};

type Props = {
  activeId: ExploreCategoryId;
  onChange: (id: ExploreCategoryId) => void;
};

export function CategoryFilter({ activeId, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {EXPLORE_CATEGORIES.map((cat) => {
        const isActive = cat.id === activeId;
        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => onChange(cat.id)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={[
              styles.chip,
              isActive ? styles.chipActive : styles.chipInactive,
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? TOKENS.textActive : TOKENS.text,
                  fontWeight: isActive ? "700" : "500",
                },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
      <View style={{ width: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: TOKENS.active,
  },
  chipInactive: {
    backgroundColor: TOKENS.inactive,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  label: {
    fontSize: 14,
  },
});
