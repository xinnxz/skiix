import React, { useMemo, useState } from "react";
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

function passwordIsStrong(p: string) {
  return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);
}

export default function ChangePasswordScreen() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const error = useMemo(() => {
    if (!current) return null;
    if (next && !passwordIsStrong(next))
      return "Use 8+ chars with upper, lower, and a number.";
    if (next && confirm && next !== confirm)
      return "Passwords do not match.";
    return null;
  }, [current, next, confirm]);

  const canSubmit =
    !!current && passwordIsStrong(next) && next === confirm && !saving;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) throw new Error("Not signed in");

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signErr) {
        toast.error("Current password is incorrect.");
        return;
      }

      const { error: updErr } = await supabase.auth.updateUser({
        password: next,
      });
      if (updErr) {
        toast.error(updErr.message || "Couldn't update password.");
        return;
      }
      toast.success("Password updated");
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
          <Text style={styles.headerTitle}>Change Password</Text>
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
            <FieldLabel>Current password</FieldLabel>
            <PasswordField
              value={current}
              onChange={setCurrent}
              visible={showCurrent}
              onToggle={() => setShowCurrent((v) => !v)}
              placeholder="Enter current password"
            />

            <FieldLabel>New password</FieldLabel>
            <PasswordField
              value={next}
              onChange={setNext}
              visible={showNext}
              onToggle={() => setShowNext((v) => !v)}
              placeholder="At least 8 characters"
            />

            <FieldLabel>Confirm new password</FieldLabel>
            <PasswordField
              value={confirm}
              onChange={setConfirm}
              visible={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              placeholder="Re-enter new password"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              onPress={onSubmit}
              activeOpacity={0.85}
              disabled={!canSubmit}
              style={[
                styles.submit,
                { opacity: canSubmit ? 1 : 0.5 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={styles.submitLabel}>Update Password</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function PasswordField({
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name="lock-closed-outline" size={18} color={TOKENS.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#555555"
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity onPress={onToggle} hitSlop={8}>
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={18}
          color={TOKENS.textMuted}
        />
      </TouchableOpacity>
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
  input: {
    flex: 1,
    color: TOKENS.text,
    fontSize: 15,
  },
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
  submitLabel: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "700",
  },
});
