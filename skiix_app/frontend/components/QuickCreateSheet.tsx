import React, { type ComponentProps } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect?: (action: "reel" | "text" | "story" | "project") => void;
  onOpenDrafts?: () => void;
};

export function QuickCreateSheet({ visible, onClose, onSelect, onOpenDrafts }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Quick Create</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={14}>
              <Feather name="x" size={22} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            <MenuButton
              icon="videocam-outline"
              label="Post Reel"
              subtitle="Share your journey"
              onPress={() => onSelect?.("reel")}
            />
            <MenuButton
              icon="chatbox-ellipses-outline"
              label="Post Text"
              subtitle="Share your thoughts"
              onPress={() => onSelect?.("text")}
            />
            <MenuButton
              icon="camera-outline"
              label="Add Story"
              subtitle="24h moments"
              onPress={() => onSelect?.("story")}
            />
            <MenuButton
              icon="rocket-outline"
              label="Project Update"
              subtitle="Milestone alert"
              onPress={() => onSelect?.("project")}
            />
          </View>

          <TouchableOpacity
            onPress={() => onOpenDrafts?.()}
            disabled={!onOpenDrafts}
            activeOpacity={onOpenDrafts ? 0.85 : 1}
            style={[styles.draftsRow, !onOpenDrafts && styles.draftsRowDisabled]}
          >
            <Ionicons name="sparkles" size={20} color="#00E5FF" />
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={styles.draftsTitle}>Drafts</Text>
              <Text style={styles.draftsSub}>Continue working</Text>
            </View>
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function MenuButton({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      <Ionicons name={icon} size={22} color="#00E5FF" />
      <Text style={styles.cardTitle}>{label}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.78)" },
  sheet: {
    backgroundColor: "#0D1216",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  draftsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  draftsRowDisabled: { opacity: 0.45 },
  draftsTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  draftsSub: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 },
  card: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 10 },
  cardSubtitle: { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 },
  cancelBtn: { paddingTop: 14, alignItems: "center" },
  cancelText: { color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: "600" },
});

