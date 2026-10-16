import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { ROLES, type RoleId } from "@/constants/roles";
import {
  getOnboardingDraft,
  patchOnboardingDraft,
  setOnboardingStep,
} from "@/utils/onboardingProgress";

export default function OnboardingStep2() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<RoleId | null>(null);

  // 24px outer padding + 16px gap between cards.
  const cardWidth = Math.floor((width - 48 - 16) / 2);

  useEffect(() => {
    (async () => {
      const draft = await getOnboardingDraft();
      if (draft.role_tag) setSelected(draft.role_tag as RoleId);
    })();
  }, []);

  const onContinue = async () => {
    if (!selected) return;
    await patchOnboardingDraft({ role_tag: selected });
    await setOnboardingStep(3);
    router.push("/(onboarding)/step3");
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
        <ProgressDots total={4} current={2} />
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>What best describes you?</Text>
        <Text style={styles.subtitle}>
          Pick one — you can always change this later
        </Text>

        <View style={styles.grid}>
          {ROLES.map((role) => {
            const isSelected = selected === role.id;
            return (
              <Pressable
                key={role.id}
                onPress={() => setSelected(role.id)}
                style={({ pressed }) => [
                  styles.card,
                  { width: cardWidth },
                  isSelected ? styles.cardSelected : styles.cardUnselected,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={role.label}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={role.icon}
                    size={26}
                    color={isSelected ? "#00E5FF" : "#888888"}
                  />
                </View>
                <Text
                  style={[
                    styles.cardLabel,
                    isSelected && styles.cardLabelSelected,
                  ]}
                >
                  {role.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onContinue}
          disabled={!selected}
          style={({ pressed }) => [
            styles.cta,
            !selected && styles.ctaDisabled,
            pressed && selected && { opacity: 0.9 },
          ]}
          accessibilityLabel="Continue to next step"
        >
          <Text
            style={[styles.ctaText, !selected && styles.ctaTextDisabled]}
          >
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
  subtitle: {
    color: "#AAAAAA",
    fontSize: 14,
    marginTop: 8,
    marginBottom: 28,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    backgroundColor: "#111111",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 116,
  },
  cardUnselected: {
    borderWidth: 1.5,
    borderColor: "#1F1F1F",
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: "#00E5FF",
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  cardLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  cardLabelSelected: { color: "#00E5FF" },
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
