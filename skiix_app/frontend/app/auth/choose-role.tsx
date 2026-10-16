import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/store/auth.store";
import { ROLES, type RoleId } from "@/constants/roles";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2;

export default function ChooseRoleScreen() {
  const { setSignupRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);

  const canContinue = useMemo(() => !!selectedRole, [selectedRole]);

  const handleContinue = () => {
    if (!selectedRole) return;
    setSignupRole(selectedRole);
    router.push("/auth/register");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Choose your role</Text>
          <Text style={styles.subtitle}>
            This helps us personalize your experience.
          </Text>
        </View>

        <View style={styles.grid}>
          {ROLES.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelectedRole(role.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <View
                  style={[styles.iconBox, isSelected && styles.iconBoxSelected]}
                >
                  <Ionicons
                    name={role.icon}
                    size={24}
                    color={isSelected ? "#00E5FF" : "#666666"}
                  />
                </View>
                <Text style={styles.roleTitle}>{role.label}</Text>
                <Text style={styles.roleSubtitle}>{role.subtitle}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>

        <View style={styles.signinRow}>
          <Text style={styles.signinText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace("/auth/login")}>
            <Text style={styles.signinLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 28,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#888888",
    lineHeight: 22,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardSelected: {
    borderColor: "#00E5FF",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  iconBoxSelected: {
    backgroundColor: "#1E3A4A",
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 13,
    color: "#888888",
    lineHeight: 18,
  },
  continueBtn: {
    backgroundColor: "#00E5FF",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000000",
  },
  signinRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  signinText: {
    fontSize: 14,
    color: "#888888",
  },
  signinLink: {
    fontSize: 14,
    color: "#00E5FF",
    fontWeight: "600",
  },
});
