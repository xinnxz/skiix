// ============================================================
// SIGN UP — multi-step profile creation
// Role → Email/Password → Name → Next (Profile setup + Personalize)
// ============================================================

import React, { useMemo, useRef, useState } from "react";
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

type Role = "founder" | "investor" | "team_member" | "advisor";
type Step = "role" | "credentials" | "name";

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

export default function RegisterScreen() {
  const router = useRouter();
  const { register, error, clearError, isLoading } = useAuth();
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role>("founder");
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const pass1Ref = useRef<TextInput>(null);
  const pass2Ref = useRef<TextInput>(null);
  const firstRef = useRef<TextInput>(null);
  const lastRef = useRef<TextInput>(null);

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

  const canContinueRole = useMemo(() => !!role, [role]);

  const onCreateAccount = async (data: RegisterForm) => {
    clearError();
    try {
      if (data.password !== data.confirm_password) {
        return;
      }
      await register({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        role,
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        display_name: `${data.first_name.trim()} ${data.last_name.trim()}`.trim(),
      });
      // Next step is profile setup (username/bio/photo), then personalize feed.
      router.replace("/auth/profile-setup");
    } catch {
      // store
    }
  };

  const goNext = async () => {
    clearError();
    if (step === "role") {
      if (!canContinueRole) return;
      setStep("credentials");
      return;
    }
    if (step === "credentials") {
      const ok = await trigger(["email", "password", "confirm_password"]);
      if (!ok) return;
      const { password, confirm_password } = getValues();
      if (password !== confirm_password) return;
      setStep("name");
      // focus first name
      setTimeout(() => firstRef.current?.focus(), 50);
      return;
    }
    // step === "name"
    void handleSubmit(onCreateAccount)();
  };

  const stepTitle =
    step === "role"
      ? "Choose your role"
      : step === "credentials"
        ? "Create an account"
        : "Your name";
  const stepSubtitle =
    step === "role"
      ? "This helps us personalize your experience."
      : step === "credentials"
        ? "Create your account with email and password."
        : "Tell us your first and last name.";

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

        {step === "role" ? (
          <View style={styles.roleGrid}>
            <RoleCard
              title="Founder"
              subtitle="Building a startup"
              icon="rocket-outline"
              selected={role === "founder"}
              onPress={() => setRole("founder")}
            />
            <RoleCard
              title="Investor"
              subtitle="Backing founders"
              icon="cash-outline"
              selected={role === "investor"}
              onPress={() => setRole("investor")}
            />
            <RoleCard
              title="Team"
              subtitle="Joining a startup"
              icon="people-outline"
              selected={role === "team_member"}
              onPress={() => setRole("team_member")}
            />
            <RoleCard
              title="Advisor"
              subtitle="Mentor & guide"
              icon="sparkles-outline"
              selected={role === "advisor"}
              onPress={() => setRole("advisor")}
            />
          </View>
        ) : null}

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
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
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

function RoleCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        {
          width: "48%",
          padding: 14,
          borderRadius: 18,
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: selected ? Colors.primary : "rgba(255,255,255,0.08)",
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: selected
              ? "rgba(112,218,255,0.18)"
              : "rgba(255,255,255,0.06)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: selected
              ? "rgba(112,218,255,0.35)"
              : "rgba(255,255,255,0.08)",
          }}
        >
          <Ionicons
            name={icon}
            size={18}
            color={selected ? Colors.primary : Colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: Colors.textPrimary, fontWeight: "700" }}>
            {title}
          </Text>
          <Text
            style={{
              color: Colors.textMuted,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
