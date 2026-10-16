import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

const TOKENS = {
  bg: "#0A0A0A",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
};

export type ComingSoonProps = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  heading?: string;
  description?: string;
};

export function ComingSoonScreen({
  title,
  icon = "construct-outline",
  heading = "Coming Soon",
  description = "We're working on this feature.",
}: ComingSoonProps) {
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
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.body}>
          <Ionicons name={icon} size={48} color={TOKENS.cyan} />
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.description}>{description}</Text>
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
  heading: { color: TOKENS.text, fontSize: 20, fontWeight: "700" },
  description: {
    color: TOKENS.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
