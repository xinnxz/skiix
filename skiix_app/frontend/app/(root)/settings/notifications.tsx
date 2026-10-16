import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { toast } from "sonner-native";
import {
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from "@/utils/settingsStorage";

const TOKENS = {
  bg: "#0A0A0A",
  card: "#111111",
  border: "#1F1F1F",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
};

const ITEMS: Array<{
  key: keyof NotificationSettings;
  label: string;
  desc: string;
}> = [
  { key: "likes", label: "Likes", desc: "When someone likes your post" },
  { key: "comments", label: "Comments", desc: "When someone comments on your post" },
  { key: "follows", label: "New followers", desc: "When someone follows you" },
  { key: "messages", label: "Messages", desc: "New direct messages" },
  { key: "projectUpdates", label: "Project updates", desc: "Updates from joined projects" },
  { key: "storyReplies", label: "Story replies", desc: "Replies to your stories" },
  { key: "mentions", label: "Mentions", desc: "When someone mentions you" },
  { key: "marketing", label: "Skiix updates", desc: "Product news and announcements" },
];

export default function NotificationsSettingsScreen() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    void loadNotificationSettings().then(setSettings);
  }, []);

  const toggle = useCallback(
    async (key: keyof NotificationSettings) => {
      if (!settings) return;
      const next = { ...settings, [key]: !settings[key] };
      setSettings(next);
      try {
        await saveNotificationSettings(next);
      } catch {
        setSettings(settings);
        toast.error("Could not save preference.");
      }
    },
    [settings],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={TOKENS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>

        {!settings ? (
          <View style={styles.center}>
            <ActivityIndicator color={TOKENS.cyan} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={styles.card}>
              {ITEMS.map((item, index) => (
                <View key={item.key}>
                  <View style={styles.row}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.rowLabel}>{item.label}</Text>
                      <Text style={styles.rowDesc}>{item.desc}</Text>
                    </View>
                    <Switch
                      value={settings[item.key]}
                      onValueChange={() => void toggle(item.key)}
                      trackColor={{ false: "#2A2A2A", true: "rgba(0,229,255,0.3)" }}
                      thumbColor={settings[item.key] ? TOKENS.cyan : "#555555"}
                    />
                  </View>
                  {index < ITEMS.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.bg },
  header: {
    paddingHorizontal: 8,
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
  divider: { height: 1, backgroundColor: TOKENS.border, marginLeft: 16 },
});
