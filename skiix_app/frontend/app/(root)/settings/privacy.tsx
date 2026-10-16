import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { toast } from "sonner-native";
import {
  loadPrivacySettings,
  savePrivacySettings,
  type PrivacySettings,
} from "@/utils/settingsStorage";

const TOKENS = {
  bg: "#0A0A0A",
  card: "#111111",
  border: "#1F1F1F",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
  chevron: "#444444",
};

export default function PrivacyScreen() {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);

  useEffect(() => {
    void loadPrivacySettings().then(setSettings);
  }, []);

  const patch = useCallback(
    async (partial: Partial<PrivacySettings>) => {
      if (!settings) return;
      const next = { ...settings, ...partial };
      setSettings(next);
      try {
        await savePrivacySettings(next);
      } catch {
        setSettings(settings);
        toast.error("Could not save setting.");
      }
    },
    [settings],
  );

  const dmLabel =
    settings?.allowDMs === "everyone"
      ? "Everyone"
      : settings?.allowDMs === "nobody"
        ? "Nobody"
        : "Connections";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={TOKENS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Settings</Text>
          <View style={styles.headerBtn} />
        </View>

        {!settings ? (
          <View style={styles.center}>
            <ActivityIndicator color={TOKENS.cyan} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={styles.card}>
              <ToggleRow
                label="Private Account"
                desc="Only approved followers can see your posts"
                value={settings.privateAccount}
                onChange={(v) => void patch({ privateAccount: v })}
              />
              <Divider />
              <ToggleRow
                label="Show Online Status"
                desc="Let others see when you're active"
                value={settings.showOnlineStatus}
                onChange={(v) => void patch({ showOnlineStatus: v })}
              />
              <Divider />
              <ToggleRow
                label="Allow Tagging"
                desc="Others can tag you in posts"
                value={settings.allowTagging}
                onChange={(v) => void patch({ allowTagging: v })}
              />
              <Divider />
              <ToggleRow
                label="Show Activity"
                desc="Display your recent activity on your profile"
                value={settings.showActivity}
                onChange={(v) => void patch({ showActivity: v })}
              />
              <Divider />
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  Alert.alert("Who can message you?", undefined, [
                    {
                      text: "Everyone",
                      onPress: () => void patch({ allowDMs: "everyone" }),
                    },
                    {
                      text: "Connections only",
                      onPress: () => void patch({ allowDMs: "connections" }),
                    },
                    { text: "Nobody", onPress: () => void patch({ allowDMs: "nobody" }) },
                    { text: "Cancel", style: "cancel" },
                  ])
                }
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.rowLabel}>Who can message me</Text>
                  <Text style={styles.rowDesc}>Control who can send you DMs</Text>
                </View>
                <Text style={styles.rowValue}>{dmLabel}</Text>
                <Ionicons name="chevron-forward" size={16} color={TOKENS.chevron} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#2A2A2A", true: "rgba(0,229,255,0.3)" }}
        thumbColor={value ? TOKENS.cyan : "#555555"}
      />
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: TOKENS.text, fontSize: 18, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { color: TOKENS.text, fontSize: 15, fontWeight: "500" },
  rowDesc: { color: TOKENS.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  rowValue: { color: TOKENS.cyan, fontSize: 14, fontWeight: "600", marginRight: 4 },
  divider: { height: 1, backgroundColor: TOKENS.border, marginLeft: 16 },
});
