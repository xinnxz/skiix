import icons from "@/constants/icons";
import { Redirect, Tabs, router } from "expo-router";
import {
  Image,
  View,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Text,
} from "react-native";
import { useAuth } from "@/store/auth.store";
import { Colors } from "@/theme";
import React, { useRef, useState } from "react";
import { QuickCreateSheet } from "@/components/QuickCreateSheet";

const TabIcons = ({
  focused,
  icon,
}: {
  focused: boolean;
  icon: any;
}) => {
  return (
    // minWidth ensures the container is wide enough for the text
    // items-center makes sure everything stays aligned
    <View style={{ width: 72 }} className="items-center justify-center pt-2">
      <Image
        source={icon}
        tintColor={focused ? "#00E5FF" : "#FFFFFF66"}
        resizeMode="contain"
        className="w-6 h-6"
      />
    </View>
  );
};

const TabLayout = () => {
  const { isLoading, stage, isAuthenticated, session } = useAuth();
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const openQuickCreate = () => {
    setQuickCreateOpen(true);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.12,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const openReels = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.12,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
    router.push("/reels");
  };

  // While auth is resolving, avoid flashing tabs for logged-out users.
  if (isLoading && (stage === "boot" || stage === "guest")) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.bgBlack,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  // Hard gate: tabs should never render for unauthenticated users.
  if (!session || !isAuthenticated) {
    return <Redirect href="/auth/welcome" />;
  }

  return (
    <>
      <Tabs
        screenOptions={{
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#0A0F12",
          position: "absolute",
          borderTopColor: "rgba(255, 255, 255, 0.05)",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 90 : 70,
          // Remove paddingBottom calculation that often causes squeezing
          paddingTop: 10,
          elevation: 0,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
        },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcons icon={icons.home} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcons icon={icons.search} focused={focused} />
            ),
          }}
        />

        {/* Center action button (Explore Reels) */}
        <Tabs.Screen
          name="create"
          options={{
            title: "Explore",
            headerShown: false,
            tabBarButton: (props) => (
              <View style={{ width: 88, alignItems: "center" }}>
                <TouchableOpacity
                  // Do NOT call props.onPress; we don't want to navigate to the route.
                  onPress={openReels}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Explore reels"
                  style={{
                    marginTop: -22,
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: "#00E5FF",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#00E5FF",
                    shadowOpacity: 0.5,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 10,
                  }}
                >
                  <Animated.View style={{ transform: [{ scale }] }}>
                    <Image
                      source={icons.playbutton}
                      resizeMode="contain"
                      style={{ width: 28, height: 28, tintColor: "#0A0F12" }}
                    />
                  </Animated.View>
                </TouchableOpacity>
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="connect"
          options={{
            title: "Connect",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcons icon={icons.handshake} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcons icon={icons.person} focused={focused} />
            ),
          }}
        />
      </Tabs>

      {/* Floating + button (opens Quick Create sheet) */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: 22,
          bottom: Platform.OS === "ios" ? 108 : 92,
          alignItems: "flex-end",
          zIndex: 50,
        }}
      >
        <TouchableOpacity
          onPress={openQuickCreate}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Create"
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: "#00E5FF",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#00E5FF",
            shadowOpacity: 0.35,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
        >
          <Text style={{ color: "#0A0F12", fontWeight: "900", fontSize: 30, lineHeight: 30 }}>
            +
          </Text>
        </TouchableOpacity>
      </View>

      <QuickCreateSheet
        visible={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onOpenDrafts={() => {
          setQuickCreateOpen(false);
          router.push("/drafts");
        }}
        onSelect={(action) => {
          setQuickCreateOpen(false);
          if (action === "story") router.push("/create-story");
          if (action === "project") router.push("/create-project-update");
          if (action === "text") router.push("/create-text");
          if (action === "reel") router.push("/create-reel");
        }}
      />
    </>
  );
};

export default TabLayout;
