// ============================================================
// SIGN UP — role chosen on `/auth/choose-role` → credentials → name
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Colors, Typography, BorderRadius } from "@/theme";
import { Button, Input } from "@/components/common";
import { useAuth } from "@/store/auth.store";
import type { RoleId } from "@/constants/roles";

const registerSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[0-9]/, "Include a number")
    .regex(/[^a-zA-Z0-9]/, "Include a special character"),
  confirm_password: z.string(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
});

type RegisterForm = z.infer<typeof registerSchema>;
type Step = "credentials" | "name";

export default function RegisterScreen() {
  const router = useRouter();
  const { register, error, clearError, isLoading, signupRole } = useAuth();
  const [step, setStep] = useState<Step>("credentials");
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const pass1Ref = useRef<TextInput>(null);
  const pass2Ref = useRef<TextInput>(null);
  const firstRef = useRef<TextInput>(null);
  const lastRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!signupRole) {
      router.replace("/auth/choose-role");
    }
  }, [signupRole, router]);

  const {
    control,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirm_password: "",
      first_name: "",
      last_name: "",
    },
  });

  const role = signupRole as RoleId;

  const onCreateAccount = async (data: RegisterForm) => {
    clearError();
    if (!role) return;
    try {
      if (data.password !== data.confirm_password) {
        return;
      }
      const out = await register({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        role,
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        display_name: `${data.first_name.trim()} ${data.last_name.trim()}`.trim(),
      });
      if (!out.needsEmailVerification) {
        router.replace("/(onboarding)/step1");
        return;
      }
      const email = data.email.trim().toLowerCase();
      const displayName = `${data.first_name.trim()} ${data.last_name.trim()}`.trim();
      router.push({
        pathname: "/auth/verify-email",
        params: {
          email,
          role,
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          display_name: displayName,
          fullName: displayName,
          username: email.split("@")[0].replace(/[^a-z0-9_]/g, "_").slice(0, 32),
        },
      });
    } catch {
      // store
    }
  };

  const goNext = async () => {
    clearError();
    if (step === "credentials") {
      const ok = await trigger(["email", "password", "confirm_password"]);
      if (!ok) return;
      const { password, confirm_password } = getValues();
      if (password !== confirm_password) return;
      setStep("name");
      setTimeout(() => firstRef.current?.focus(), 50);
      return;
    }
    void handleSubmit(onCreateAccount)();
  };

  const stepTitle =
    step === "credentials" ? "Create an account" : "Your name";
  const stepSubtitle =
    step === "credentials"
      ? "Create your account with email and password."
      : "Tell us your first and last name.";

  if (!signupRole) {
    return null;
  }

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
          <Text style={styles.title}>{stepTitle}</Text>
          <Text style={styles.subtitle}>{stepSubtitle}</Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={Colors.destructive}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {step === "credentials" ? (
          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => pass1Ref.current?.focus()}
                  leftIcon="mail-outline"
                  error={errors.email?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={pass1Ref}
                  label="Password"
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showPass}
                  returnKeyType="next"
                  onSubmitEditing={() => pass2Ref.current?.focus()}
                  leftIcon="lock-closed-outline"
                  error={errors.password?.message}
                  rightElement={
                    <TouchableOpacity
                      onPress={() => setShowPass((s) => !s)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name={showPass ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color={Colors.textMuted}
                      />
                    </TouchableOpacity>
                  }
                />
              )}
            />
            <Controller
              control={control}
              name="confirm_password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={pass2Ref}
                  label="Confirm password"
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showPass2}
                  returnKeyType="done"
                  onSubmitEditing={goNext}
                  leftIcon="lock-closed-outline"
                  error={errors.confirm_password?.message}
                  rightElement={
                    <TouchableOpacity
                      onPress={() => setShowPass2((s) => !s)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name={showPass2 ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color={Colors.textMuted}
                      />
                    </TouchableOpacity>
                  }
                />
              )}
            />
          </View>
        ) : null}

        {step === "name" ? (
          <View style={styles.form}>
            <Controller
              control={control}
              name="first_name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={firstRef}
                  label="First name"
                  placeholder="John"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="next"
                  onSubmitEditing={() => lastRef.current?.focus()}
                  leftIcon="person-outline"
                  error={errors.first_name?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="last_name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={lastRef}
                  label="Last name"
                  placeholder="Doe"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="done"
                  onSubmitEditing={goNext}
                  leftIcon="person-outline"
                  error={errors.last_name?.message}
                />
              )}
            />
          </View>
        ) : null}

        <Button
          label={step === "name" ? "Create account" : "Continue"}
          onPress={goNext}
          variant="primary"
          size="lg"
          loading={isLoading}
          style={{ marginTop: 8 }}
        />

        <View style={styles.row}>
          <Text style={styles.mutedText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace("/auth/login")}>
            <Text style={styles.link}>Sign in</Text>
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
  header: { marginBottom: 32, gap: 8 },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: { color: Colors.textSecondary, fontSize: Typography.base, lineHeight: 22 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.destructiveMuted,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.destructive,
    padding: 12,
    marginBottom: 20,
  },
  errorText: { color: Colors.destructive, fontSize: Typography.sm, flex: 1 },
  form: { gap: 16, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
  },
  mutedText: { color: Colors.textSecondary, fontSize: Typography.sm },
  link: { color: Colors.primary, fontSize: Typography.sm, fontWeight: "600" },
});
