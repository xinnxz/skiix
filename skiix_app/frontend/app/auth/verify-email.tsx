// After signup — wait for magic link tap or manual check; optional OTP entry.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { supabase } from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { resendSignupEmail } from "@/services/supabaseAuthService";
import { useAuth } from "@/store/auth.store";
import {
  finishEmailVerificationFlow,
  isEmailConfirmed,
  refreshSessionAndCheckConfirmed,
} from "@/lib/postSignupVerification";
import { normalizeRoleId } from "@/constants/roles";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string;
    fullName?: string;
    display_name?: string;
    username?: string;
    role?: string;
    first_name?: string;
    last_name?: string;
  }>();
  const { rehydrateSession, setSignupRole, signupRole } = useAuth();

  const email = (params.email ?? "").trim().toLowerCase();
  const fullName =
    (params.fullName as string) ||
    (params.display_name as string) ||
    `${params.first_name ?? ""} ${params.last_name ?? ""}`.trim();
  const username = (params.username as string)?.trim().toLowerCase();
  const roleTag = normalizeRoleId((params.role as string) || signupRole || "") ?? "founder";

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!email) router.replace("/auth/choose-role");
  }, [email, router]);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const onVerified = useCallback(async () => {
    if (handled.current) return;
    handled.current = true;
    await rehydrateSession();
    setSignupRole(null);
    await finishEmailVerificationFlow(router, {
      email,
      fullName,
      username,
      roleTag,
    });
  }, [rehydrateSession, setSignupRole, router, email, fullName, username, roleTag]);

  useEffect(() => {
    if (!email) return;

    const poll = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && isEmailConfirmed(data.session)) {
        await onVerified();
        return;
      }
      const refreshed = await refreshSessionAndCheckConfirmed();
      if (refreshed) await onVerified();
    };

    void poll();
    const interval = setInterval(() => void poll(), 3000);
    return () => clearInterval(interval);
  }, [email, onVerified]);

  const handleCheckVerification = async () => {
    setChecking(true);
    try {
      const session = await refreshSessionAndCheckConfirmed();
      if (session) {
        await onVerified();
        return;
      }
      Alert.alert(
        "Not verified yet",
        "Open the email from Skiix and tap Verify Email, or enter the 6-digit code below.",
        [{ text: "OK" }],
      );
    } catch {
      toast.error("Could not check verification status.");
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    setCanResend(false);
    setCountdown(60);
    try {
      const { error } = await resendSignupEmail(email, getAuthRedirectUrl());
      if (error) {
        toast.error(error.message);
        setCanResend(true);
        setCountdown(0);
      } else {
        Alert.alert("Email sent", `Verification email resent to ${email}`);
      }
    } catch {
      toast.error("Failed to resend. Try again.");
      setCanResend(true);
      setCountdown(0);
    } finally {
      setResending(false);
    }
  };

  if (!email) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Ionicons name="mail-outline" size={64} color="#00E5FF" />
          </View>

          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>We sent a confirmation link to:</Text>
          <Text style={styles.email}>{email}</Text>

          <Text style={styles.instruction}>
            Open the email and tap{" "}
            <Text style={styles.instructionBold}>Verify Email</Text>
            {"\n"}to activate your account. You can also use the 6-digit code in the
            email.
          </Text>

          <View style={styles.checkingRow}>
            <ActivityIndicator size="small" color="#00E5FF" />
            <Text style={styles.checkingText}>Waiting for verification…</Text>
          </View>

          <TouchableOpacity
            style={styles.checkBtn}
            onPress={() => void handleCheckVerification()}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Text style={styles.checkBtnText}>✓ I&apos;ve verified my email</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resendBtn, !canResend && styles.resendBtnDisabled]}
            onPress={() => void handleResend()}
            disabled={!canResend || resending}
          >
            {resending ? (
              <ActivityIndicator size="small" color="#00E5FF" />
            ) : (
              <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]}>
                {canResend ? "Resend verification email" : `Resend in ${countdown}s`}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.otpOption}
            onPress={() =>
              router.push({
                pathname: "/auth/verify-otp",
                params: {
                  email,
                  role: roleTag,
                  display_name: fullName,
                  username: username ?? "",
                  first_name: params.first_name ?? "",
                  last_name: params.last_name ?? "",
                },
              })
            }
          >
            <Text style={styles.otpOptionText}>Enter 6-digit code instead</Text>
          </TouchableOpacity>

          <Text style={styles.spamNote}>
            💡 Check your spam or junk folder if you don&apos;t see it
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 8,
    paddingBottom: 40,
  },
  backBtn: { alignSelf: "flex-start", padding: 8, marginBottom: 8 },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "#0D2A35",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#00E5FF",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: { fontSize: 15, color: "#888888", textAlign: "center" },
  email: {
    fontSize: 15,
    color: "#00E5FF",
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 24,
    textAlign: "center",
  },
  instruction: {
    fontSize: 15,
    color: "#AAAAAA",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  instructionBold: { color: "#FFFFFF", fontWeight: "700" },
  checkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  checkingText: { color: "#888888", fontSize: 14 },
  checkBtn: {
    backgroundColor: "#00E5FF",
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 14,
  },
  checkBtnText: { color: "#000000", fontSize: 16, fontWeight: "800" },
  resendBtn: { paddingVertical: 12 },
  resendBtnDisabled: {},
  resendText: { color: "#00E5FF", fontSize: 14, fontWeight: "600" },
  resendTextDisabled: { color: "#555555" },
  otpOption: { marginTop: 8, paddingVertical: 10 },
  otpOptionText: {
    color: "#888888",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  spamNote: {
    color: "#555555",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
});
