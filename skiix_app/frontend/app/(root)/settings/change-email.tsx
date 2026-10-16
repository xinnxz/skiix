import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { toast } from "sonner-native";
import { supabase } from "@/lib/supabase";

const TOKENS = {
  bg: "#0A0A0A",
  card: "#111111",
  border: "#1F1F1F",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
  danger: "#FF4444",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmailScreen() {
  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setCurrentEmail(data.user?.email ?? "");
    });
    return () => {
      alive = false;
    };
  }, []);

  const error = useMemo(() => {
    if (newEmail && !EMAIL_RE.test(newEmail.trim()))
      return "Please enter a valid email address.";
    if (newEmail && newEmail.trim().toLowerCase() === currentEmail.toLowerCase())
      return "That's already your email.";
    return null;
  }, [newEmail, currentEmail]);

  const canSubmit =
    !!password && !!newEmail && EMAIL_RE.test(newEmail.trim()) && !saving;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const cleanEmail = newEmail.trim().toLowerCase();

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      });
      if (signErr) {
        toast.error("Password is incorrect.");
        return;
      }

      const { error: updErr } = await supabase.auth.updateUser({
        email: cleanEmail,
      });
      if (updErr) {
        toast.error(updErr.message || "Couldn't update email.");
        return;
      }
      toast.success("Confirmation links sent. Check both inboxes.");
      router.back();
    } catch (e: any) {
      toast.error(String(e?.message ?? "Something went wrong."));
    } finally {
      setSaving(false);
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
          <Text style={styles.headerTitle}>Change Email</Text>
          <View style={styles.headerBtn} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          >
            <Text style={styles.subtitle}>
              Supabase sends a confirmation to your current and new address.
              You stay signed in until you confirm.
            </Text>

            <Text style={styles.fieldLabel}>Current email</Text>
            <View style={[styles.inputWrap, { opacity: 0.7 }]}>
              <Ionicons name="mail-outline" size={18} color={TOKENS.textMuted} />
              <TextInput
                style={styles.input}
                value={currentEmail}
                editable={false}
                placeholderTextColor="#555555"
              />
            </View>

            <Text style={styles.fieldLabel}>New email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={TOKENS.textMuted} />
              <TextInput
                style={styles.input}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="you@example.com"
                placeholderTextColor="#555555"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.fieldLabel}>Confirm with password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={TOKENS.textMuted} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Your current password"
                placeholderTextColor="#555555"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={TOKENS.textMuted}
                />
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              onPress={onSubmit}
              activeOpacity={0.85}
              disabled={!canSubmit}
              style={[styles.submit, { opacity: canSubmit ? 1 : 0.5 }]}
            >
              {saving ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={styles.submitLabel}>Send confirmation</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
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
  subtitle: {
    color: TOKENS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 4,
    marginHorizontal: 4,
  },
  fieldLabel: {
    color: TOKENS.textMuted,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 16,
    marginLeft: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, color: TOKENS.text, fontSize: 15 },
  errorText: {
    color: TOKENS.danger,
    fontSize: 12,
    marginTop: 10,
    marginLeft: 4,
  },
  submit: {
    marginTop: 24,
    backgroundColor: TOKENS.cyan,
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  submitLabel: { color: "#0A0A0A", fontSize: 15, fontWeight: "700" },
});
