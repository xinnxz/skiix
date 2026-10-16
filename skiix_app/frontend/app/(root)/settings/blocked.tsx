import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

const TOKENS = {
  bg: "#0A0A0A",
  card: "#111111",
  border: "#1F1F1F",
  iconBg: "#1A1A1A",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
};

export default function BlockedUsersScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={TOKENS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-outline" size={28} color={TOKENS.cyan} />
          </View>
          <Text style={styles.heading}>No blocked users</Text>
          <Text style={styles.description}>
            People you block won't be able to find your profile or message you.
          </Text>
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
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TOKENS.iconBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heading: { color: TOKENS.text, fontSize: 18, fontWeight: "700" },
  description: {
    color: TOKENS.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
});
