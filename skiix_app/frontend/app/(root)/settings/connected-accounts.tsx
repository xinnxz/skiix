import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { toast } from "sonner-native";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle } from "@/services/supabaseAuthService";

const TOKENS = {
  bg: "#0A0A0A",
  card: "#111111",
  border: "#1F1F1F",
  iconBg: "#1A1A1A",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
};

type ProviderId = "google" | "apple";

type ProviderRow = {
  id: ProviderId;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const PROVIDERS: ProviderRow[] = [
  { id: "google", name: "Google", icon: "logo-google" },
  { id: "apple", name: "Apple", icon: "logo-apple" },
];

export default function ConnectedAccountsScreen() {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState<Set<ProviderId>>(new Set());
  const [busyProvider, setBusyProvider] = useState<ProviderId | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const ids = (data.user?.identities ?? [])
          .map((i) => i.provider as ProviderId)
          .filter((p) => p === "google" || p === "apple");
        if (alive) {
          setLinked(new Set(ids));
          setEmail(data.user?.email ?? "");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const description = useMemo(
    () =>
      email
        ? `Sign-in providers linked to ${email}.`
        : "Sign-in providers linked to your account.",
    [email],
  );

  const handleConnect = async (provider: ProviderId) => {
    if (busyProvider) return;
    setBusyProvider(provider);
    try {
      if (provider === "google") {
        const { error } = await signInWithGoogle();
        if (error) {
          toast.error(error.message || "Couldn't connect Google.");
          return;
        }
        const { data } = await supabase.auth.getUser();
        const ids = (data.user?.identities ?? [])
          .map((i) => i.provider as ProviderId)
          .filter((p) => p === "google" || p === "apple");
        setLinked(new Set(ids));
        toast.success("Google account linked");
      } else {
        toast.info("Apple sign-in coming soon.");
      }
    } finally {
      setBusyProvider(null);
    }
  };

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
          <Text style={styles.headerTitle}>Connected Accounts</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <Text style={styles.description}>{description}</Text>

          {loading ? (
            <View style={{ paddingTop: 64, alignItems: "center" }}>
              <ActivityIndicator color={TOKENS.cyan} />
            </View>
          ) : (
            <View style={[styles.card, { marginTop: 18 }]}>
              {PROVIDERS.map((p, idx) => {
                const isLinked = linked.has(p.id);
                const busy = busyProvider === p.id;
                return (
                  <React.Fragment key={p.id}>
                    <View style={styles.row}>
                      <View style={styles.iconCircle}>
                        <Ionicons name={p.icon} size={18} color={TOKENS.text} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel}>{p.name}</Text>
                        <Text style={styles.rowSub}>
                          {isLinked ? "Connected" : "Not connected"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        disabled={isLinked || busy}
                        onPress={() => handleConnect(p.id)}
                        activeOpacity={0.85}
                        style={[
                          styles.actionBtn,
                          isLinked ? styles.actionBtnLinked : null,
                        ]}
                      >
                        {busy ? (
                          <ActivityIndicator color={isLinked ? TOKENS.text : "#0A0A0A"} />
                        ) : (
                          <Text
                            style={[
                              styles.actionLabel,
                              isLinked ? { color: TOKENS.text } : null,
                            ]}
                          >
                            {isLinked ? "Linked" : "Connect"}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    {idx < PROVIDERS.length - 1 ? <View style={styles.divider} /> : null}
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </ScrollView>
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
  description: {
    color: TOKENS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginHorizontal: 4,
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
    paddingVertical: 14,
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
  rowLabel: { color: TOKENS.text, fontSize: 15, fontWeight: "500" },
  rowSub: { color: TOKENS.textMuted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: TOKENS.border, marginLeft: 66 },
  actionBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    backgroundColor: TOKENS.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnLinked: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  actionLabel: { color: "#0A0A0A", fontWeight: "700", fontSize: 13 },
});
