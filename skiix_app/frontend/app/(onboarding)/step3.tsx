import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { ChipPill } from "@/components/onboarding/ChipPill";
import {
  INTERESTS,
  INTERESTS_MIN_REQUIRED,
  INTERESTS_MAX_ALLOWED,
  formatInterestTag,
} from "@/constants/interests";
import {
  getOnboardingDraft,
  patchOnboardingDraft,
  setOnboardingStep,
} from "@/utils/onboardingProgress";

export default function OnboardingStep3() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const draft = await getOnboardingDraft();
      if (Array.isArray(draft.interests)) setSelected(draft.interests);
    })();
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= INTERESTS_MAX_ALLOWED) {
        toast.error(`${INTERESTS_MAX_ALLOWED} max`, { id: "interest-max" });
        return prev;
      }
      return [...prev, id];
    });
  };

  const enough = selected.length >= INTERESTS_MIN_REQUIRED;
  const countColor = useMemo(() => (enough ? "#22C55E" : "#888888"), [enough]);

  const onContinue = async () => {
    if (!enough) return;
    await patchOnboardingDraft({ interests: selected });
    await setOnboardingStep(4);
    router.push("/(onboarding)/step4");
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.back}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </Pressable>
        <ProgressDots total={4} current={3} />
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>What are you into?</Text>
        <Text style={styles.subtitle}>
          Pick at least {INTERESTS_MIN_REQUIRED} topics that interest you
        </Text>

        <View style={styles.countRow}>
          <Text style={[styles.countText, { color: countColor }]}>
            {selected.length} selected
          </Text>
          <Text style={styles.countHint}>
            Max {INTERESTS_MAX_ALLOWED}
          </Text>
        </View>

        <View style={styles.grid}>
          {INTERESTS.map((id) => (
            <ChipPill
              key={id}
              label={formatInterestTag(id)}
              selected={selected.includes(id)}
              onPress={() => toggle(id)}
              size="sm"
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onContinue}
          disabled={!enough}
          style={({ pressed }) => [
            styles.cta,
            !enough && styles.ctaDisabled,
            pressed && enough && { opacity: 0.9 },
          ]}
          accessibilityLabel="Continue to next step"
        >
          <Text style={[styles.ctaText, !enough && styles.ctaTextDisabled]}>
            Continue →
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  back: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 24, paddingBottom: 24 },
  title: { color: "#FFFFFF", fontSize: 26, fontWeight: "700", marginTop: 8 },
  subtitle: { color: "#AAAAAA", fontSize: 14, marginTop: 8 },
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  countText: { fontSize: 13, fontWeight: "600" },
  countHint: { color: "#555555", fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: "#0A0A0A",
  },
  cta: {
    width: "100%",
    backgroundColor: "#00E5FF",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaDisabled: { backgroundColor: "#1F1F1F" },
  ctaText: { color: "#000000", fontSize: 16, fontWeight: "700" },
  ctaTextDisabled: { color: "#555555" },
});
