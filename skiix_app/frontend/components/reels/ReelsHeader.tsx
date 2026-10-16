import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActionSheetIOS,
  Alert,
  Platform,
  Share,
} from "react-native";
import { Ionicons, Entypo } from "@expo/vector-icons";
import { router } from "expo-router";
import { useReelsStore } from "@/store/reelsStore";

type Props = {
  topInset: number;
  shareLabel?: string;
};

export function ReelsHeader({ topInset, shareLabel }: Props) {
  const activeTab = useReelsStore((s) => s.activeTab);
  const setActiveTab = useReelsStore((s) => s.setActiveTab);

  const onMenu = useCallback(() => {
    const options = ["Cancel", "Share", "Not interested", "Report"];
    const cancel = 0;
    const onAction = async (index: number) => {
      if (index === 1) {
        try {
          await Share.share({ message: shareLabel ?? "Check this reel on Skiix" });
        } catch {
          // user cancelled or share unavailable
        }
        return;
      }
      if (index === 2) {
        Alert.alert("Got it", "We'll show fewer reels like this.");
        return;
      }
      if (index === 3) {
        Alert.alert("Reported", "Thanks for letting us know.");
      }
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancel,
          destructiveButtonIndex: 3,
          userInterfaceStyle: "dark",
        },
        onAction,
      );
    } else {
      Alert.alert(
        "Reel options",
        undefined,
        [
          { text: "Share", onPress: () => onAction(1) },
          { text: "Not interested", onPress: () => onAction(2) },
          { text: "Report", style: "destructive", onPress: () => onAction(3) },
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true },
      );
    }
  }, [shareLabel]);

  return (
    <View
      style={[styles.wrap, { paddingTop: topInset + 4 }]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.tabs}>
          <Tab
            label="For You"
            active={activeTab === "for-you"}
            onPress={() => setActiveTab("for-you")}
          />
          <Tab
            label="Following"
            active={activeTab === "following"}
            onPress={() => setActiveTab("following")}
          />
        </View>

        <TouchableOpacity
          onPress={onMenu}
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityLabel="More options"
        >
          <Entypo name="dots-three-vertical" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Tab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.tab}>
      <Text
        style={[
          styles.tabLabel,
          {
            color: active ? "#FFFFFF" : "rgba(255,255,255,0.5)",
            fontWeight: active ? "700" : "500",
          },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.underline,
          { backgroundColor: active ? "#00E5FF" : "transparent" },
        ]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  tab: {
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 15,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  underline: {
    marginTop: 4,
    width: 28,
    height: 2,
    borderRadius: 2,
  },
});
