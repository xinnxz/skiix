import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

const TOKENS = {
  bg: "#0A0A0A",
  card: "#111111",
  border: "#1F1F1F",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
};

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧", available: true },
  { code: "ar", label: "Arabic", flag: "🇸🇦", available: false },
  { code: "fr", label: "French", flag: "🇫🇷", available: false },
  { code: "de", label: "German", flag: "🇩🇪", available: false },
  { code: "es", label: "Spanish", flag: "🇪🇸", available: false },
  { code: "zh", label: "Chinese", flag: "🇨🇳", available: false },
  { code: "ur", label: "Urdu", flag: "🇵🇰", available: false },
] as const;

export default function LanguageScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={TOKENS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Language</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={{ padding: 16 }}>
          <View style={styles.card}>
            {LANGUAGES.map((lang, i) => (
              <View key={lang.code}>
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (!lang.available) {
                      Alert.alert("Coming Soon", `${lang.label} support coming soon!`);
                    }
                  }}
                >
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <Text style={styles.langLabel}>{lang.label}</Text>
                  {lang.code === "en" ? (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  ) : null}
                  {!lang.available ? (
                    <Text style={styles.soonText}>Soon</Text>
                  ) : null}
                </TouchableOpacity>
                {i < LANGUAGES.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
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
    paddingVertical: 16,
    gap: 12,
  },
  flag: { fontSize: 22 },
  langLabel: { flex: 1, color: TOKENS.text, fontSize: 15, fontWeight: "500" },
  activeBadge: {
    backgroundColor: "rgba(0,229,255,0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: TOKENS.cyan,
  },
  activeBadgeText: { color: TOKENS.cyan, fontSize: 11, fontWeight: "700" },
  soonText: { color: TOKENS.textMuted, fontSize: 12, fontWeight: "600" },
  divider: { height: 1, backgroundColor: TOKENS.border, marginLeft: 16 },
});
