import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Ionicons,
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { RadialGlowBackground } from "@/components/RadialGlowBackground";
import { router } from "expo-router";
import { useAuth } from "@/store/auth.store";
import { interestLabel } from "@/constants/personalizeInterests";

export default function ProfileScreen() {
  const { user, authUser, isLoading, logout } = useAuth();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted || isLoading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator color="#00E5FF" size="large" />
      </View>
    );
  }

  const email = user?.email ?? "";
  const displayName = user?.display_name?.trim()
    ? user.display_name.trim()
    : email
      ? email.split("@")[0]
      : "User";

  const avatarUrl =
    user?.avatar_url ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName,
    )}&background=0A0F12&color=70DAFF`;

  const rawInterests = (authUser?.user_metadata as any)?.preferences?.interests;
  const interests: string[] = Array.isArray(rawInterests)
    ? (rawInterests.filter(Boolean) as string[])
    : [];

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <RadialGlowBackground />

      <SafeAreaView edges={["top"]} className="flex-1">
        {/* HEADER (like screenshot) */}
        <View className="px-6 py-4 items-center justify-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-6 p-2"
          >
            <Ionicons name="chevron-back" size={26} color="white" />
          </TouchableOpacity>

          <Text className="text-white font-spaceBold text-base">
            Your Profile
          </Text>

          <TouchableOpacity
            onPress={async () => {
              await logout();
              router.replace("/auth/welcome");
            }}
            className="absolute right-6 p-2"
          >
            <Ionicons name="settings-outline" size={22} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
          {/* HERO */}
          <View className="px-6 mt-2 items-center">
            <View className="relative">
              <View className="w-[112px] h-[112px] rounded-full border-2 border-[#70DAFF] p-1">
                <Image
                  source={{ uri: avatarUrl }}
                  className="w-full h-full rounded-full"
                />
              </View>
              <TouchableOpacity
                onPress={() => router.push("/auth/profile-setup")}
                activeOpacity={0.85}
                className="absolute bottom-0 right-0 bg-[#00E5FF] rounded-full border-2 border-black"
                style={{
                  width: 34,
                  height: 34,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="add" size={18} color="black" />
              </TouchableOpacity>
            </View>

            <View className="mt-4 items-center">
              <View className="flex-row items-center">
                <Text className="text-white text-2xl font-spaceBold">
                  {displayName}
                </Text>
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={18}
                  color="#70DAFF"
                  style={{ marginLeft: 8 }}
                />
              </View>

              <View className="flex-row items-center mt-2">
                <Ionicons
                  name="location-outline"
                  size={14}
                  color="#70DAFF"
                />
                <Text className="text-[#70DAFF] ml-1 font-space text-xs">
                  {user?.location?.trim() || "Set your location"}
                </Text>
              </View>

              {user?.tagline?.trim() ? (
                <Text className="text-[#FFFFFF99] font-space text-xs mt-2 text-center">
                  {user.tagline}
                </Text>
              ) : null}
            </View>
          </View>

          {/* ACTION BUTTONS */}
          <View className="flex-row px-6 mt-6 gap-3">
            <TouchableOpacity
              onPress={() => router.push("/auth/profile-setup")}
              className="flex-1 flex-row items-center justify-center bg-[#70DAFF] py-3 rounded-full"
              activeOpacity={0.85}
            >
              <Feather name="edit-2" size={16} color="black" />
              <Text className="text-black font-spaceBold ml-2 text-sm">
                Edit Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center bg-[#FFFFFF]/10 py-3 rounded-full border border-[#FFFFFF]/10"
              activeOpacity={0.85}
            >
              <Feather name="share-2" size={16} color="white" />
              <Text className="text-white font-spaceBold ml-2 text-sm">
                Share
              </Text>
            </TouchableOpacity>
          </View>

          {/* PROFESSIONAL BIO */}
          <View style={styles.card} className="mx-6 mt-6 p-5">
            <Text className="text-[#FFFFFF66] text-[10px] uppercase mb-3 tracking-widest">
              PROFESSIONAL BIO
            </Text>
            <Text className="text-[#FFFFFFE5] text-sm leading-6">
              {user?.bio?.trim() || "Add your professional bio in Edit Profile."}
            </Text>
          </View>

          {/* INTERESTS */}
          <View style={styles.card} className="mx-6 mt-4 p-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[#FFFFFF66] text-[10px] uppercase tracking-widest">
                INTERESTS
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/personalize")}
                activeOpacity={0.85}
              >
                <Text className="text-[#00E5FF] text-[10px] font-spaceBold tracking-widest">
                  PERSONALIZE ›
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap gap-2">
              {interests.length ? (
                interests.map((t) => (
                  <View
                    key={t}
                    className="bg-[#FFFFFF]/5 px-3 py-1.5 rounded-full border border-[#FFFFFF]/10"
                  >
                    <Text className="text-xs text-white">#{interestLabel(t)}</Text>
                  </View>
                ))
              ) : (
                <Text className="text-[#FFFFFF55] text-xs leading-5">
                  Tap Personalize to choose topics for your feed.
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
});
