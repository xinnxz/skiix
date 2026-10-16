import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import {
  ROLES,
  type RoleId,
  normalizeRoleId,
} from "@/constants/roles";

type Props = {
  visible: boolean;
  currentRole: string | null;
  onSelect: (role: RoleId) => void;
  onClose: () => void;
};

export function RolePickerModal({
  visible,
  currentRole,
  onSelect,
  onClose,
}: Props) {
  const active = normalizeRoleId(currentRole);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      <View style={styles.sheet} pointerEvents="box-none">
        <View style={styles.handle} />

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Your role</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color="#888888" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sheetSubtitle}>
          Choose the role that best describes you
        </Text>

        <View style={styles.roleList}>
          {ROLES.map((role) => {
            const isActive = active === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                style={[styles.roleRow, isActive && styles.roleRowActive]}
                onPress={() => {
                  onSelect(role.id);
                  onClose();
                }}
                activeOpacity={0.75}
              >
                <View style={styles.roleRowLeft}>
                  <View
                    style={[
                      styles.roleRowIcon,
                      isActive && styles.roleRowIconActive,
                    ]}
                  >
                    <Ionicons
                      name={role.icon}
                      size={20}
                      color={isActive ? "#00E5FF" : "#666666"}
                    />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.roleRowTitle,
                        isActive && styles.roleRowTitleActive,
                      ]}
                    >
                      {role.label}
                    </Text>
                    <Text style={styles.roleRowSubtitle}>{role.subtitle}</Text>
                  </View>
                </View>
                {isActive ? (
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={14} color="#000000" />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#111111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#333333",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sheetSubtitle: {
    fontSize: 14,
    color: "#888888",
    marginBottom: 24,
  },
  roleList: {
    gap: 10,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  roleRowActive: {
    borderColor: "#00E5FF",
    backgroundColor: "#0D2A35",
  },
  roleRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  roleRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
  },
  roleRowIconActive: {
    backgroundColor: "#1E3A4A",
  },
  roleRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  roleRowTitleActive: {
    color: "#00E5FF",
  },
  roleRowSubtitle: {
    fontSize: 13,
    color: "#888888",
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#00E5FF",
    alignItems: "center",
    justifyContent: "center",
  },
});
