import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { toast } from "sonner-native";
import { useAuth } from "@/store/auth.store";

import { InterestsSection } from "@/components/profile/InterestsSection";
import { SkillsSection } from "@/components/profile/SkillsSection";
import { SocialLinks } from "@/components/profile/SocialLinks";
import { StatsRow } from "@/components/profile/StatsRow";
import { RoleTag } from "@/components/profile/RoleTag";
import { InterestPickerSheet } from "@/components/sheets/InterestPickerSheet";
import { SkillPickerSheet } from "@/components/sheets/SkillPickerSheet";

import { supabase } from "@/lib/supabase";
import { profileApi, type UserStats } from "@/utils/profile.api";

export default function ProfileScreen() {
  const { openInterests } = useLocalSearchParams<{ openInterests?: string }>();
  const { user, authUser, isLoading } = useAuth();
  const [hasMounted, setHasMounted] = useState(false);
  const [stats, setStats] = useState<UserStats>({
    posts_count: 0,
    followers_count: 0,
    following_count: 0,
    projects_count: 0,
  });

  // Local optimistic state for interests/skills so save-then-render feels instant.
  const seedInterests = useMemo(() => user?.interests ?? [], [user?.interests]);
  const seedSkills = useMemo(() => user?.skills ?? [], [user?.skills]);
  const [interests, setInterests] = useState<string[]>(seedInterests);
  const [skills, setSkills] = useState<string[]>(seedSkills);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);

  useEffect(() => setHasMounted(true), []);
  useEffect(() => setInterests(seedInterests), [seedInterests]);
  useEffect(() => setSkills(seedSkills), [seedSkills]);

  useEffect(() => {
    if (openInterests === "1") {
      setInterestsOpen(true);
    }
  }, [openInterests]);

  const refreshStats = useCallback(async () => {
    if (!user?.username) return;
    try {
      const s = await profileApi.getStats(user.username);
      setStats(s);
    } catch {
      // ignore — defaults to zeros
    }
  }, [user?.username]);

  useFocusEffect(
    useCallback(() => {
      refreshStats();
    }, [refreshStats]),
  );

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

  const updateSupabaseMeta = async (patch: Record<string, unknown>) => {
    const { data } = await supabase.auth.getUser();
    const prev = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    const { error } = await supabase.auth.updateUser({
      data: { ...prev, ...patch },
    });
    if (error) throw error;
  };

  const saveInterests = async (next: string[]) => {
    const prev = interests;
    setInterests(next); // optimistic
    try {
      const cur = ((authUser?.user_metadata as any)?.preferences ?? {}) as Record<
        string,
        unknown
      >;
      await updateSupabaseMeta({
        interests: next,
        preferences: { ...cur, interests: next },
      });
      try {
        await profileApi.updateMe({ interests: next });
      } catch {
        // backend is best-effort; metadata is the visible source
      }
      toast.success("Interests updated");
    } catch (e: any) {
      setInterests(prev);
      throw e;
    }
  };

  const saveSkills = async (next: string[]) => {
    const prev = skills;
    setSkills(next); // optimistic
    try {
      await updateSupabaseMeta({ skills: next });
      try {
        await profileApi.updateMe({ skills: next });
      } catch {
        // ignore
      }
      toast.success("Skills updated");
    } catch (e: any) {
      setSkills(prev);
      throw e;
    }
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <RadialGlowBackground />

      <SafeAreaView edges={["top"]} className="flex-1">
        <View className="px-6 py-4 items-center justify-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-6 p-2"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color="white" />
          </TouchableOpacity>

          <Text className="text-white font-spaceBold text-base">
            Your Profile
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/settings" as Href)}
            className="absolute right-6 p-2"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
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
                accessibilityLabel="Edit profile"
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

              {user?.username ? (
                <Text
                  className="text-[#FFFFFF99] font-space text-sm mt-1"
                  style={{ letterSpacing: 0.2 }}
                >
                  @{user.username}
                </Text>
              ) : null}

              <View
                style={styles.subRow}
                className="flex-row items-center mt-2"
              >
                <RoleTag value={user?.role_tag} />
                {user?.location?.trim() ? (
                  <View style={styles.locationRow}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color="#70DAFF"
                    />
                    <Text style={styles.locationText}>
                      {user.location.trim()}
                    </Text>
                  </View>
                ) : null}
              </View>

              {user?.tagline?.trim() ? (
                <Text className="text-[#FFFFFF99] font-space text-xs mt-2 text-center">
                  {user.tagline}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="flex-row px-6 mt-6 gap-3">
            <TouchableOpacity
              onPress={() => router.push("/auth/profile-setup")}
              className="flex-1 flex-row items-center justify-center bg-[#70DAFF] py-3 rounded-full"
              activeOpacity={0.85}
              accessibilityLabel="Edit profile"
            >
              <Feather name="edit-2" size={16} color="black" />
              <Text className="text-black font-spaceBold ml-2 text-sm">
                Edit Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center bg-[#FFFFFF]/10 py-3 rounded-full border border-[#FFFFFF]/10"
              activeOpacity={0.85}
              accessibilityLabel="Share profile"
            >
              <Feather name="share-2" size={16} color="white" />
              <Text className="text-white font-spaceBold ml-2 text-sm">
                Share
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mx-6 mt-6">
            <StatsRow
              posts={stats.posts_count}
              followers={stats.followers_count}
              projects={stats.projects_count}
            />
          </View>

          {user?.bio?.trim() ? (
            <View style={styles.card} className="mx-6 mt-4 p-5">
              <Text className="text-[#FFFFFF66] text-[10px] uppercase mb-3 tracking-widest">
                Professional Bio
              </Text>
              <Text className="text-[#FFFFFFE5] text-sm leading-6">
                {user.bio}
              </Text>
            </View>
          ) : null}

          <View className="mx-6 mt-4">
            <InterestsSection
              interests={interests}
              onEdit={() => setInterestsOpen(true)}
            />
          </View>

          <View className="mx-6 mt-4">
            <SkillsSection skills={skills} onEdit={() => setSkillsOpen(true)} />
          </View>

          <View className="mx-6 mt-4">
            <SocialLinks
              twitter={user?.twitter_handle ?? null}
              linkedin={user?.linkedin_url ?? null}
              github={user?.github_handle ?? null}
              website={user?.website_url ?? null}
            />
          </View>
        </ScrollView>
      </SafeAreaView>

      <InterestPickerSheet
        visible={interestsOpen}
        initial={interests}
        onClose={() => setInterestsOpen(false)}
        onSave={saveInterests}
      />
      <SkillPickerSheet
        visible={skillsOpen}
        initial={skills}
        onClose={() => setSkillsOpen(false)}
        onSave={saveSkills}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  subRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { color: "#70DAFF", fontSize: 12 },
});
