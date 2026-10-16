import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { ChipPill } from "@/components/onboarding/ChipPill";
import { SKILLS, SKILLS_MAX_ALLOWED } from "@/constants/skills";
import {
  clearOnboarding,
  getOnboardingDraft,
} from "@/utils/onboardingProgress";
import { useAuth } from "@/store/auth.store";

export default function OnboardingStep4() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [roleTag, setRoleTag] = useState<string>("");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const draft = await getOnboardingDraft();
      setRoleTag(draft.role_tag ?? "");
      setInterests(Array.isArray(draft.interests) ? draft.interests : []);
      setSelected(Array.isArray(draft.skills) ? draft.skills : []);
    })();
  }, []);

  const toggle = (label: string) => {
    setSelected((prev) => {
      if (prev.includes(label)) return prev.filter((x) => x !== label);
      if (prev.length >= SKILLS_MAX_ALLOWED) {
        toast.error(`${SKILLS_MAX_ALLOWED} max`, { id: "skill-max" });
        return prev;
      }
      return [...prev, label];
    });
  };

  const onFinish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await completeOnboarding({
        interests,
        skills: selected,
        role_tag: roleTag,
      });
      await clearOnboarding();
      toast.success("Welcome to Skiix");
      router.replace("/(root)/(tabs)");
    } catch (e: any) {
      toast.error(String(e?.message ?? "Could not finish setup."));
    } finally {
      setSaving(false);
    }
  };

  const hasSkills = selected.length > 0;

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
        <ProgressDots total={4} current={4} />
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>What are your core skills?</Text>
        <Text style={styles.subtitle}>
          Pick up to {SKILLS_MAX_ALLOWED} skills that define you
        </Text>

        {hasSkills && (
          <View style={styles.selectedCard}>
            <Text style={styles.selectedHeader}>
              Selected · {selected.length}/{SKILLS_MAX_ALLOWED}
            </Text>
            <View style={styles.selectedGrid}>
              {selected.map((s) => (
                <ChipPill
                  key={`sel-${s}`}
                  label={s}
                  selected
                  onPress={() => toggle(s)}
                  size="md"
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.grid}>
          {SKILLS.map((label) => (
            <ChipPill
              key={label}
              label={label}
              selected={selected.includes(label)}
              onPress={() => toggle(label)}
              size="md"
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onFinish}
          disabled={saving}
          style={({ pressed }) => [
            styles.cta,
            saving && styles.ctaDisabled,
            pressed && !saving && { opacity: 0.9 },
          ]}
          accessibilityLabel="Finish setup"
        >
          {saving ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.ctaText}>Finish Setup →</Text>
          )}
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
  subtitle: { color: "#AAAAAA", fontSize: 14, marginTop: 8, marginBottom: 20 },
  selectedCard: {
    backgroundColor: "rgba(0,229,255,0.05)",
    borderColor: "rgba(0,229,255,0.25)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  selectedHeader: {
    color: "#00E5FF",
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  selectedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
});
