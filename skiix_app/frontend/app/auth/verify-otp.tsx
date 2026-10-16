// ============================================================
// EMAIL OTP — after signup (or login when email not confirmed)
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Typography } from "@/theme";
import { Button } from "@/components/common";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/store/auth.store";
import { navigateAfterAuth } from "@/lib/navigateAfterAuth";
import { toast } from "sonner-native";
import { AUTH_FROM_DISPLAY } from "@/constants/authEmail";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { normalizeRoleId } from "@/constants/roles";
import { createUserProfileIfNeeded } from "@/lib/postSignupVerification";
import { resendSignupEmail } from "@/services/supabaseAuthService";

const BOX = 48;
const GAP = 8;

function parseOtpError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("expired")) {
    return "Code expired. Tap Resend to get a new one.";
  }
  if (m.includes("already confirmed")) {
    return "Already verified — try signing in.";
  }
  if (m.includes("invalid") || m.includes("wrong") || m.includes("token")) {
    return "Wrong code. Check your email and try again.";
  }
  if (m.includes("already been used") || m.includes("already used")) {
    return "This code was already used. Request a new one.";
  }
  return "Verification failed. Please try again.";
}

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string;
    role?: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
    username?: string;
  }>();
  const { rehydrateSession, signupRole, setSignupRole } = useAuth();

  const email = (params.email ?? "").trim().toLowerCase();
  const fromSignup = Boolean(
    params.display_name || params.first_name || params.role,
  );

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [failures, setFailures] = useState(0);
  const refs = useRef<(TextInput | null)[]>([]);
  const lastSubmitted = useRef("");
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!email) {
      router.replace("/auth/choose-role");
    }
  }, [email, router]);

  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const runShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  const clearBoxes = useCallback(() => {
    lastSubmitted.current = "";
    setDigits(["", "", "", "", "", ""]);
    setTimeout(() => refs.current[0]?.focus(), 0);
  }, []);

  const submitOtp = useCallback(
    async (code: string) => {
      if (verifying || code.length !== 6) return;
      if (failures >= 3) {
        toast.error("Too many attempts. Request a new code.");
        return;
      }
      setVerifying(true);
      setInlineError("");
      try {
        const otp = code.replace(/\D/g, "");
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: "signup",
        });
        if (error) {
          const msg = parseOtpError(error.message);
          if (/already verified/i.test(msg)) {
            toast.info(msg);
            router.replace("/auth/login");
            return;
          }
          setFailures((f) => f + 1);
          runShake();
          clearBoxes();
          setInlineError(msg);
          return;
        }
        const session = data.session;
        if (!session?.user?.id) {
          toast.error("Could not complete verification. Please try again.");
          return;
        }
        await rehydrateSession();
        if (fromSignup) {
          const rawRole = (params.role as string) || signupRole || "";
          const roleTag = normalizeRoleId(rawRole) ?? "founder";
          const fullName =
            (params.display_name as string) ||
            `${params.first_name ?? ""} ${params.last_name ?? ""}`.trim();
          const username =
            (params.username as string) ||
            email.split("@")[0].replace(/[^a-z0-9_]/g, "_").slice(0, 32);

          setSignupRole(null);
          const ok = await finishEmailVerificationFlow(router, {
            email,
            fullName,
            username,
            roleTag,
          });
          if (!ok) {
            toast.error("Email verified but session missing. Try signing in.");
          }
        } else {
          await navigateAfterAuth(router);
        }
      } catch {
        runShake();
        clearBoxes();
        setInlineError("Something went wrong. Try again.");
      } finally {
        setVerifying(false);
      }
    },
    [
      email,
      fromSignup,
      params.display_name,
      params.role,
      signupRole,
      rehydrateSession,
      setSignupRole,
      router,
      runShake,
      failures,
      verifying,
      clearBoxes,
    ],
  );

  useEffect(() => {
    const c = digits.join("");
    if (c.length !== 6 || verifying) return;
    if (lastSubmitted.current === c) return;
    lastSubmitted.current = c;
    void submitOtp(c);
  }, [digits, verifying, submitOtp]);

  const onDigitChange = (index: number, raw: string) => {
    const d = raw.replace(/\D/g, "");
    setDigits((prev) => {
      if (d.length >= 6) {
        setTimeout(() => refs.current[5]?.focus(), 0);
        return d.slice(0, 6).split("");
      }
      if (d.length === 1) {
        const next = [...prev];
        next[index] = d;
        setTimeout(() => {
          if (index < 5) refs.current[index + 1]?.focus();
        }, 0);
        return next;
      }
      if (d.length === 0) {
        const next = [...prev];
        next[index] = "";
        setTimeout(() => {
          if (index > 0) refs.current[index - 1]?.focus();
        }, 0);
        return next;
      }
      return prev;
    });
  };

  const onKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const onResend = async () => {
    if (countdown > 0) return;
    setCountdown(60);
    setInlineError("");
    clearBoxes();

    const { error: resendError } = await resendSignupEmail(email, getAuthRedirectUrl());

    if (resendError) {
      const m = resendError.message.toLowerCase();
      if (m.includes("rate limit")) {
        setInlineError("Please wait before requesting another code.");
      } else {
        setInlineError("Failed to resend. Try again.");
      }
      setCountdown(0);
      return;
    }

    toast.success(`New code sent to ${email}`);
    setFailures(0);
  };

  const filled = digits.every((x) => x.length === 1);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bgBlack }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to:{"\n"}
            <Text style={styles.email}>{email}</Text>
          </Text>
          <Text style={styles.hint}>
            Enter the 6-digit code from {AUTH_FROM_DISPLAY}, or tap Verify Email in
            the message to open the app.
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.replace({
                pathname: "/auth/verify-email",
                params: {
                  email,
                  role: params.role ?? "",
                  display_name: params.display_name ?? "",
                  username: params.username ?? "",
                  first_name: params.first_name ?? "",
                  last_name: params.last_name ?? "",
                },
              })
            }
            style={{ marginTop: 8 }}
          >
            <Text style={styles.linkMuted}>Waiting for the email link instead?</Text>
          </TouchableOpacity>
        </View>

        <Animated.View
          style={[styles.otpRow, { transform: [{ translateX: shake }] }]}
        >
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => {
                refs.current[i] = r;
              }}
              style={[
                styles.box,
                d ? styles.boxFilled : styles.boxEmpty,
              ]}
              value={d}
              onChangeText={(t) => onDigitChange(i, t)}
              onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={i === 0 ? 6 : 1}
              selectTextOnFocus
              textAlign="center"
              placeholderTextColor={Colors.textMuted}
            />
          ))}
        </Animated.View>

        {inlineError ? (
          <Text style={styles.errorText}>{inlineError}</Text>
        ) : null}

        <Button
          label="Verify code"
          onPress={() => void submitOtp(digits.join(""))}
          variant="primary"
          size="lg"
          loading={verifying}
          disabled={!filled || verifying || failures >= 3}
          style={{ marginTop: 24 }}
        />

        <View style={styles.footer}>
          <Text style={styles.muted}>Didn&apos;t receive a code?</Text>
          {countdown > 0 ? (
            <Text style={styles.countdown}>Resend code ({countdown}s)</Text>
          ) : (
            <TouchableOpacity onPress={onResend} hitSlop={12}>
              <Text style={styles.link}>Resend code</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.replace("/auth/choose-role")}
            style={{ marginTop: 16 }}
            hitSlop={12}
          >
            <Text style={styles.linkMuted}>Wrong email? Go back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  header: { marginBottom: 28, gap: 8 },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  email: { color: Colors.primary, fontWeight: "600" },
  hint: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    marginTop: 8,
    lineHeight: 20,
  },
  errorText: {
    color: "#FF4444",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: GAP,
    marginTop: 8,
  },
  box: {
    width: BOX,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.surface2,
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    borderWidth: 2,
  },
  boxEmpty: { borderColor: "#1F1F1F" },
  boxFilled: { borderColor: Colors.primary },
  footer: { marginTop: 32, alignItems: "center" },
  muted: { color: Colors.textSecondary, fontSize: Typography.sm },
  countdown: { color: Colors.textMuted, fontSize: Typography.sm, marginTop: 6 },
  link: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: "600",
    marginTop: 6,
  },
  linkMuted: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    textDecorationLine: "underline",
  },
});
