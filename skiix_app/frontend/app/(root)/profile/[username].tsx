import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "@/utils/axiosInstance";
import { useAuth } from "@/store/auth.store";
import { followApi } from "@/utils/follow.api";
import { toast } from "sonner-native";
import { cleanHandle, displayFullName } from "@/utils/displayIdentity";

type PublicUser = {
  id?: string;
  username?: string;
  /** Clean @handle (never a full email) — from Go `publicProfile`. */
  handle?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  role_tag?: string;
  is_verified?: boolean;
  full_name?: string;
};

function titleCaseHandle(h: string) {
  return h
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const slug = typeof username === "string" ? decodeURIComponent(username) : "";
  const { user } = useAuth();
  const myEmail = user?.email ?? "";

  const [u, setU] = useState<PublicUser | null>(null);
  const [myBackendId, setMyBackendId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!slug) {
      setU(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [meRes, profRes] = await Promise.all([
        myEmail
          ? apiClient.get<PublicUser & { email?: string }>(`/api/v1/users/me`, {
              params: { email: myEmail.toLowerCase() },
            })
          : Promise.resolve({ data: {} as PublicUser }),
        apiClient.get<PublicUser>(`/api/v1/users/${encodeURIComponent(slug)}`),
      ]);
      setMyBackendId(typeof meRes.data?.id === "string" ? meRes.data.id : null);
      setU(profRes.data);
    } catch {
      setU(null);
      toast.error("Profile not found.");
    } finally {
      setLoading(false);
    }
  }, [slug, myEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const apiHandle = (u?.handle ?? "").trim().toLowerCase();
  const fallbackHandle = slug.replace(/^@/, "").trim().toLowerCase();
  const atHandle = apiHandle || fallbackHandle;

  const safeDisplayName = (() => {
    const dn = u?.display_name?.trim() ?? "";
    if (dn && !looksLikeEmail(dn)) return dn;
    const un = u?.username?.trim() ?? "";
    if (un && !looksLikeEmail(un)) return un;
    return "";
  })();

  const headline =
    safeDisplayName ||
    (atHandle ? titleCaseHandle(atHandle) : "") ||
    "Profile";

  const avatar =
    u?.avatar_url?.trim() ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(headline)}&background=0A0F12&color=70DAFF`;

  const isSelf = !!(u?.id && myBackendId && u.id === myBackendId);

  const onFollow = async () => {
    if (!myBackendId || !u?.id || busy || following || isSelf) return;
    setBusy(true);
    setFollowing(true);
    try {
      await followApi.followByIds({ follower_id: myBackendId, following_id: u.id });
      toast.success("Following");
    } catch {
      setFollowing(false);
      toast.error("Could not follow.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="#00E5FF" />
      </View>
    );
  }

  if (!u) {
    return (
      <SafeAreaView className="flex-1 bg-black px-4">
        <TouchableOpacity onPress={() => router.back()} className="mt-2 mb-6">
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text className="text-white font-spaceBold">User not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-4 py-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text className="text-white font-spaceBold text-lg ml-4">Profile</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="px-5">
        <View className="items-center mt-4">
          <Image source={{ uri: avatar }} className="w-28 h-28 rounded-full" />
          <View className="flex-row items-center mt-4">
            <Text className="text-white text-xl font-spaceBold">{headline}</Text>
            {u.is_verified ? (
              <Ionicons name="checkmark-circle" size={18} color="#00E5FF" style={{ marginLeft: 6 }} />
            ) : null}
          </View>
          {atHandle ? (
            <Text className="text-[#888] font-space mt-1">@{atHandle}</Text>
          ) : null}
          {u.role_tag ? (
            <Text className="text-[#00E5FF] text-xs font-spaceBold mt-2 uppercase">{u.role_tag}</Text>
          ) : null}
          {u.location ? (
            <Text className="text-[#888] text-sm font-space mt-1">{u.location}</Text>
          ) : null}
        </View>

        {u.bio ? <Text className="text-white font-space text-sm leading-6 mt-6">{u.bio}</Text> : null}

        {!isSelf && myBackendId && u.id ? (
          <View className="flex-row gap-3 mt-8 w-full">
            <TouchableOpacity
              disabled={busy || following}
              onPress={() => void onFollow()}
              className="flex-1 bg-[#00E5FF] py-3 rounded-full items-center disabled:opacity-40"
            >
              <Text className="text-black font-spaceBold">
                {following ? "Following" : busy ? "…" : "Follow"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/messages/[id]",
                  params: {
                    id: "new",
                    userId: u.id,
                    username: atHandle,
                    ...(headline && headline !== atHandle
                      ? { fullName: encodeURIComponent(headline) }
                      : {}),
                    ...(u.avatar_url?.trim() ? { avatarUrl: u.avatar_url.trim() } : {}),
                  },
                })
              }
              className="flex-1 border border-[#00E5FF] py-3 rounded-full items-center"
            >
              <Text className="text-[#00E5FF] font-spaceBold">Message</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
