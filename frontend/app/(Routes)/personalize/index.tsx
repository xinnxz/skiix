import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/store/auth.store";
import { replaceRootWhenReady } from "@/lib/replaceRootWhenReady";
import {
  PERSONALIZE_INTERESTS,
  type PersonalizeInterest,
} from "@/constants/personalizeInterests";

export default function PersonalizeScreen() {
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  const { completeOnboarding, stage } = useAuth();
  const [selectedIds, setSelectedIds] = useState<string[]>(["ai", "web3"]);
  const [saving, setSaving] = useState(false);

  const horizontalPad = 48; // px-6 * 2
  const columnGap = 14;
  const cardWidth = useMemo(
    () => Math.floor((screenW - horizontalPad - columnGap) / 2),
    [screenW],
  );

  const toggleInterest = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const finalize = async (interests: string[]) => {
    await completeOnboarding({
      interests,
      stage: [],
      goals: [],
    });
    replaceRootWhenReady(router);
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await finalize(selectedIds);
    } catch (e: any) {
      Alert.alert("Could not save", String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const onSkip = async () => {
    if (saving) return;
    if (stage !== "needs_onboarding") {
      router.back();
      return;
    }
    setSaving(true);
    try {
      await finalize([]);
    } catch (e: any) {
      Alert.alert("Could not continue", String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={{ width: 52 }} />
          <TouchableOpacity
            onPress={onSkip}
            hitSlop={12}
            disabled={saving}
            accessibilityLabel="Skip personalize"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Personalize Your Feed</Text>
          <Text style={styles.subtitle}>
            Pick what inspires you.{"\n"}You can skip this for now.
          </Text>

          <View style={styles.grid}>
            {PERSONALIZE_INTERESTS.map((item, index) => {
              const isSelected = selectedIds.includes(item.id);
              const marginRight = index % 2 === 0 ? columnGap : 0;
              return (
                <InterestCard
                  key={item.id}
                  item={item}
                  width={cardWidth}
                  marginRight={marginRight}
                  isSelected={isSelected}
                  onPress={() => toggleInterest(item.id)}
                />
              );
            })}
          </View>
        </ScrollView>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.cta, saving && styles.ctaDisabled]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#0A0F12" />
          ) : (
            <>
              <Text style={styles.ctaLabel}>Save Preferences</Text>
              <Feather name="arrow-right" size={20} color="#0A0F12" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function InterestCard({
  item,
  width,
  marginRight,
  isSelected,
  onPress,
}: {
  item: PersonalizeInterest;
  width: number;
  marginRight: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.card,
        {
          width,
          marginRight,
          marginBottom: columnGapConst,
          borderColor: isSelected ? "#00E5FF" : "rgba(255,255,255,0.08)",
          borderWidth: isSelected ? 2 : 1,
          backgroundColor: isSelected ? "rgba(0, 229, 255, 0.06)" : "#1E2228",
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.iconWrap}>{renderIcon(item, isSelected)}</View>
      <Text
        style={[styles.cardLabel, { color: isSelected ? "#FFFFFF" : "#C8D1E0" }]}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

const columnGapConst = 14;

function renderIcon(item: PersonalizeInterest, isSelected: boolean) {
  const color = isSelected ? "#00E5FF" : "#6B7589";
  const size = 32;
  const name = item.icon as never;
  switch (item.library) {
    case "MaterialCommunityIcons":
      return <MaterialCommunityIcons name={name} size={size} color={color} />;
    case "Ionicons":
      return <Ionicons name={name} size={size} color={color} />;
    case "Feather":
      return <Feather name={name} size={size} color={color} />;
    default:
      return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color} />;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  title: {
    marginTop: 12,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 32,
    lineHeight: 38,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 14,
    textAlign: "center",
    color: "#94A3BB",
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 12,
    marginBottom: 28,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  card: {
    aspectRatio: 1,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  iconWrap: {
    marginBottom: 12,
  },
  cardLabel: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 13,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  cta: {
    marginTop: "auto",
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
    minHeight: 58,
  },
  ctaDisabled: {
    opacity: 0.85,
  },
  ctaLabel: {
    color: "#0A0F12",
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 17,
    letterSpacing: 0.2,
  },
});
