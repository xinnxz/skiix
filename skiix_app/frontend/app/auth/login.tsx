// ============================================================
// LOGIN — email + password (no OTP)
// ============================================================

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Colors, Typography, BorderRadius } from "@/theme";
import { Button, Input } from "@/components/common";
import { useAuth } from "@/store/auth.store";
import { replaceRootWhenReady } from "@/lib/replaceRootWhenReady";
import icons from "@/constants/icons";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type Form = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const { login, signInWithGoogle, error, clearError, isLoading } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const passRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: Form) => {
    clearError();
    try {
      const result = await login({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });
      if (result === "needs_email_verification") {
        router.push({
          pathname: "/auth/verify-email",
          params: { email: data.email.trim().toLowerCase() },
        });
        return;
      }
      replaceRootWhenReady(router);
    } catch {
      // store shows error
    }
  };

  const onGoogle = async () => {
    clearError();
    try {
      await signInWithGoogle();
      replaceRootWhenReady(router);
    } catch {
      /* store */
    }
  };

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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Uses your Supabase Auth account (email + password you set in Authentication).
          </Text>
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
                onSubmitEditing={() => passRef.current?.focus()}
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
                ref={passRef}
                label="Password"
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleSubmit(onSubmit)}
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
        </View>

        <Button
          label="Sign in"
          onPress={handleSubmit(onSubmit)}
          variant="primary"
          size="lg"
          loading={isLoading}
          style={{ marginTop: 8 }}
        />

        <View style={styles.row}>
          <Text style={styles.mutedText}>New to Skiix?</Text>
          <TouchableOpacity onPress={() => router.push("/auth/choose-role")}>
            <Text style={styles.link}>Create an account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          onPress={onGoogle}
          disabled={isLoading}
          className="bg-[#FFFFFF]/5 border border-[#FFFFFF]/10 rounded-xl w-full py-4 mb-8"
        >
          <View className="flex flex-row items-center justify-center">
            <Image
              source={icons.google}
              className="w-5 h-5"
              resizeMode="contain"
            />
            <Text className="text-lg text-white font-spaceBold ml-2">
              Continue with Google
            </Text>
          </View>
        </TouchableOpacity>
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
  subtitle: { color: Colors.textSecondary, fontSize: Typography.base },
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
    marginTop: 20,
  },
  mutedText: { color: Colors.textSecondary, fontSize: Typography.sm },
  link: { color: Colors.primary, fontSize: Typography.sm, fontWeight: "600" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontSize: Typography.xs },
});
