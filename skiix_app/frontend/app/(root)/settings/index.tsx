import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as StoreReview from "expo-store-review";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { toast } from "sonner-native";
import { useAuth } from "@/store/auth.store";
import apiClient from "@/utils/axiosInstance";
import { supabase } from "@/lib/supabase";

const TOKENS = {
  bg: "#0A0A0A",
  card: "#111111",
  border: "#1F1F1F",
  iconBg: "#1A1A1A",
  chevron: "#444444",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
  danger: "#FF4444",
};

type IoniconName = keyof typeof Ionicons.glyphMap;

type Row = {
  icon: IoniconName;
  label: string;
  onPress?: () => void;
  rightSlot?: React.ReactNode;
  danger?: boolean;
  hideChevron?: boolean;
};

export default function SettingsScreen() {
  const { logout } = useAuth();
  const [darkMode, setDarkMode] = useState(true);

  const version = useMemo(() => {
    const v = Constants.expoConfig?.version ?? "1.0.0";
    const build = (Constants.expoConfig as any)?.runtimeVersion ?? "1";
    return `Version ${v} (build ${build})`;
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
            } finally {
              router.replace("/auth/welcome");
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [logout]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account, posts, and all data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "Your account and all content will be permanently removed.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, delete everything",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await apiClient.delete("/api/v1/users/me");
                    } catch (e) {
                      if (__DEV__) console.warn("[DeleteAccount]", e);
                    }
                    try {
                      await supabase.auth.signOut();
                    } catch {
                      /* ignore */
                    }
                    try {
                      await logout();
                    } finally {
                      router.replace("/auth/welcome");
                    }
                  },
                },
              ],
            );
          },
        },
      ],
      { cancelable: true },
    );
  }, [logout]);

  const openExternal = useCallback(async (url: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error("Cannot open URL");
      await Linking.openURL(url);
    } catch {
      toast.error("Couldn't open the link.");
    }
  }, []);

  const handleHelp = useCallback(async () => {
    const url = "https://skiix.app/support";
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* fall through */
    }
    Alert.alert("Help & Support", "For support, email us at:\nsupport@skiix.app", [
      {
        text: "Send Email",
        onPress: () => void Linking.openURL("mailto:support@skiix.app"),
      },
      { text: "OK" },
    ]);
  }, []);

  const handleRate = useCallback(async () => {
    try {
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview();
        return;
      }
    } catch {
      /* fall through */
    }
    Alert.alert("Rate Skiix", "Enjoying Skiix? Rate us on the Play Store!", [
      {
        text: "Rate Now",
        onPress: () => void openExternal("https://play.google.com/store/apps/details?id=com.skiix.app"),
      },
      { text: "Later", style: "cancel" },
    ]);
  }, [openExternal]);

  const handleDarkMode = useCallback((value: boolean) => {
    if (!value) {
      Alert.alert(
        "Dark Mode",
        "Skiix is designed for dark mode. Light mode coming soon!",
        [{ text: "OK" }],
      );
      return;
    }
    setDarkMode(true);
  }, []);

  const account: Row[] = [
    {
      icon: "person-outline",
      label: "Edit Profile",
      onPress: () => router.push("/auth/profile-setup" as Href),
    },
    {
      icon: "key-outline",
      label: "Change Password",
      onPress: () => router.push("/settings/change-password" as Href),
    },
    {
      icon: "mail-outline",
      label: "Change Email",
      onPress: () => router.push("/settings/change-email" as Href),
    },
    {
      icon: "link-outline",
      label: "Connected Accounts",
      onPress: () => router.push("/settings/connected-accounts" as Href),
    },
  ];

  const preferences: Row[] = [
    {
      icon: "color-palette-outline",
      label: "Interests & Skills",
      onPress: () =>
        router.push({
          pathname: "/(root)/(tabs)/profile",
          params: { openInterests: "1" },
        } as Href),
    },
    {
      icon: "notifications-outline",
      label: "Notifications",
      onPress: () => router.push("/settings/notifications" as Href),
    },
    {
      icon: "moon-outline",
      label: "Dark Mode",
      hideChevron: true,
      rightSlot: (
        <Switch
          value={darkMode}
          onValueChange={handleDarkMode}
          trackColor={{ false: "#2A2A2A", true: "rgba(0,229,255,0.3)" }}
          thumbColor={darkMode ? TOKENS.cyan : "#555555"}
        />
      ),
    },
    {
      icon: "globe-outline",
      label: "Language",
      onPress: () => router.push("/settings/language" as Href),
    },
  ];

  const privacy: Row[] = [
    {
      icon: "lock-closed-outline",
      label: "Privacy Settings",
      onPress: () => router.push("/settings/privacy" as Href),
    },
    {
      icon: "shield-outline",
      label: "Blocked Users",
      onPress: () => router.push("/settings/blocked" as Href),
    },
    {
      icon: "phone-portrait-outline",
      label: "Two-Factor Auth",
      onPress: () => router.push("/settings/two-factor" as Href),
    },
  ];

  const support: Row[] = [
    {
      icon: "chatbubbles-outline",
      label: "Help & Support",
      onPress: () => openExternal("https://skiix.com/support"),
    },
    {
      icon: "star-outline",
      label: "Rate Skiix",
      onPress: handleRate,
    },
    {
      icon: "document-text-outline",
      label: "Terms of Service",
      onPress: () => void openExternal("https://skiix.app/terms"),
    },
    {
      icon: "shield-checkmark-outline",
      label: "Privacy Policy",
      onPress: () => void openExternal("https://skiix.app/privacy"),
    },
  ];

  const danger: Row[] = [
    {
      icon: "log-out-outline",
      label: "Log Out",
      onPress: handleLogout,
      danger: true,
      hideChevron: true,
    },
    {
      icon: "trash-outline",
      label: "Delete Account",
      onPress: handleDeleteAccount,
      danger: true,
      hideChevron: true,
    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={TOKENS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Section title="Account" rows={account} />
          <Section title="Preferences" rows={preferences} />
          <Section title="Privacy & Security" rows={privacy} />
          <Section title="Support" rows={support} />
          <Section title="Danger Zone" rows={danger} />

          <Text style={styles.version}>{version}</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.card}>
        {rows.map((row, idx) => (
          <React.Fragment key={`${title}-${row.label}`}>
            <SettingsRow {...row} />
            {idx < rows.length - 1 ? <View style={styles.divider} /> : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  rightSlot,
  danger,
  hideChevron,
}: Row) {
  const labelColor = danger ? TOKENS.danger : TOKENS.text;
  const iconColor = danger ? TOKENS.danger : TOKENS.text;
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.row}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.iconCircle,
          danger ? { backgroundColor: "transparent" } : null,
        ]}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
      {rightSlot
        ? rightSlot
        : !hideChevron && onPress
          ? (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={TOKENS.chevron}
            />
          )
          : null}
    </Wrap>
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
  headerTitle: {
    color: TOKENS.text,
    fontSize: 18,
    fontWeight: "600",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: TOKENS.textMuted,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
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
    gap: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: TOKENS.iconBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: TOKENS.text,
  },
  divider: {
    height: 1,
    backgroundColor: TOKENS.border,
    marginLeft: 66,
  },
  version: {
    textAlign: "center",
    color: "#444444",
    fontSize: 12,
    marginTop: 24,
    marginBottom: 40,
  },
});
