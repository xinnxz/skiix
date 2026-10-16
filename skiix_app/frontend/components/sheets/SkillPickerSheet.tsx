import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { ChipPill } from "@/components/onboarding/ChipPill";
import { SKILLS, SKILLS_MAX_ALLOWED } from "@/constants/skills";

type Props = {
  visible: boolean;
  initial: string[];
  onClose: () => void;
  onSave: (selected: string[]) => Promise<void> | void;
};

/**
 * Bottom-sheet editor for the user's `skills[]`. Opened from the profile
 * CORE SKILLS section's "+ Add Skills" affordance.
 */
export function SkillPickerSheet({
  visible,
  initial,
  onClose,
  onSave,
}: Props) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setSelected(initial);
  }, [visible, initial]);

  const toggle = (label: string) => {
    setSelected((prev) => {
      if (prev.includes(label)) return prev.filter((x) => x !== label);
      if (prev.length >= SKILLS_MAX_ALLOWED) {
        toast.error(`${SKILLS_MAX_ALLOWED} max`, { id: "skill-max" });
        return prev;
      }
      return [...prev, label];
    });
  };

  const dirty = useMemo(() => {
    if (selected.length !== initial.length) return true;
    const a = [...selected].sort();
    const b = [...initial].sort();
    return a.some((v, i) => v !== b[i]);
  }, [selected, initial]);

  const onSavePress = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } catch (e: any) {
      toast.error(String(e?.message ?? "Could not save skills."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Your Core Skills</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            {selected.length}/{SKILLS_MAX_ALLOWED} selected
          </Text>

          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {SKILLS.map((label) => (
              <ChipPill
                key={label}
                label={label}
                selected={selected.includes(label)}
                onPress={() => toggle(label)}
                size="md"
              />
            ))}
          </ScrollView>

          <Pressable
            onPress={onSavePress}
            disabled={!dirty || saving}
            style={({ pressed }) => [
              styles.cta,
              (!dirty || saving) && styles.ctaDisabled,
              pressed && dirty && !saving && { opacity: 0.9 },
            ]}
            accessibilityLabel="Save skills"
          >
            {saving ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={[styles.ctaText, !dirty && styles.ctaTextDisabled]}>
                Save
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0A0A0A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: "#1F1F1F",
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A2A",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#888888", fontSize: 12, marginBottom: 16 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 12,
  },
  cta: {
    marginTop: 12,
    backgroundColor: "#00E5FF",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaDisabled: { backgroundColor: "#1F1F1F" },
  ctaText: { color: "#000000", fontSize: 15, fontWeight: "700" },
  ctaTextDisabled: { color: "#555555" },
});
