import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { useAuth } from "@/store/auth.store";
import {
  clearOnboarding,
  setOnboardingStep,
} from "@/utils/onboardingProgress";

export default function OnboardingStep1() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [skipping, setSkipping] = useState(false);

  const onStart = async () => {
    await setOnboardingStep(2);
    router.push("/(onboarding)/step2");
  };

  const onSkip = async () => {
    if (skipping) return;
    setSkipping(true);
    try {
      await completeOnboarding({ interests: [], skills: [], role_tag: "" });
      await clearOnboarding();
      router.replace("/(root)/(tabs)");
    } catch (e: any) {
      toast.error(String(e?.message ?? "Could not skip onboarding."));
    } finally {
      setSkipping(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="sparkles" size={44} color="#00E5FF" />
          </View>
          <Text style={styles.logoText}>SKIIX</Text>
        </View>

        <Text style={styles.headline}>Build Your Future</Text>
        <Text style={styles.subtext}>
          Tell us a bit about yourself to personalize your experience
        </Text>
      </View>

      <View style={styles.footer}>
        <ProgressDots total={4} current={1} />

        <Pressable
          onPress={onStart}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Get started"
        >
          <Text style={styles.ctaText}>Get Started →</Text>
        </Pressable>

        <Pressable
          onPress={onSkip}
          disabled={skipping}
          hitSlop={12}
          accessibilityLabel="Skip onboarding for now"
          style={({ pressed }) => [styles.skip, pressed && { opacity: 0.7 }]}
        >
          {skipping ? (
            <ActivityIndicator color="#888888" />
          ) : (
            <Text style={styles.skipText}>Skip for now</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0,229,255,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(0,229,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 4,
  },
  headline: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  subtext: {
    color: "#AAAAAA",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
    gap: 20,
  },
  cta: {
    width: "100%",
    backgroundColor: "#00E5FF",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaText: { color: "#000000", fontSize: 16, fontWeight: "700" },
  skip: { paddingVertical: 6 },
  skipText: {
    color: "#888888",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
