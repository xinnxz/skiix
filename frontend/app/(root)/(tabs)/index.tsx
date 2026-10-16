import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import apiClient from "@/utils/axiosInstance";
import { useAuth } from "@/store/auth.store";
import { storiesApi, StoryDTO } from "@/utils/stories.api";
import { useFocusEffect } from "@react-navigation/native";
import { countUnreadNotifications, subscribeToNotifications } from "@/services/appNotifications";
import { supabase } from "@/lib/supabase";
import { projectsApi } from "@/utils/projects.api";
import { followApi } from "@/utils/follow.api";

type BackendFeedItem = {
  id: string;
  user_id: string;
  content: string;
  media_url?: string | null;
  image_url?: string | null; // legacy
  is_project?: boolean;
  type?: "project" | "text" | "reel" | "story";
  project_id?: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author_email: string;
  is_liked: boolean;
  is_joined?: boolean;
  is_following?: boolean;
};

export default function FeedScreen() {
  const { user } = useAuth();
  const email = user?.email ?? "";

  const [notifUnread, setNotifUnread] = useState(0);

  const refreshNotifUnread = useCallback(async () => {
    if (!user?.id) {
      setNotifUnread(0);
      return;
    }
    const c = await countUnreadNotifications(user.id);
    setNotifUnread(c);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refreshNotifUnread();
    }, [refreshNotifUnread]),
  );

  useEffect(() => {
    if (!user?.id) return undefined;
    const ch = subscribeToNotifications(user.id, () => void refreshNotifUnread());
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, refreshNotifUnread]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BackendFeedItem[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [stories, setStories] = useState<StoryDTO[]>([]);
  const [ctaBusyId, setCtaBusyId] = useState<string | null>(null);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: BackendFeedItem[] }>("/api/v1/feed", {
        params: { limit: 20, offset: 0, viewer_email: email || undefined },
      });
      setItems(res.data.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadFeed();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const loadStories = async () => {
    if (!email) {
      setStories([]);
      setStoriesLoading(false);
      return;
    }
    setStoriesLoading(true);
    try {
      const res = await storiesApi.feed(email);
      setStories(res);
    } catch {
      setStories([]);
    } finally {
      setStoriesLoading(false);
    }
  };

  useEffect(() => {
    void loadStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  useFocusEffect(
    React.useCallback(() => {
      void loadStories();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [email]),
  );

  const storyRow = useMemo(() => {
    // We only want one bubble per author (latest story).
    const seen = new Set<string>();
    const unique: { key: string; author: string }[] = [];
    for (const s of stories) {
      const a = (s.author_email || "").toLowerCase();
      if (!a || seen.has(a)) continue;
      seen.add(a);
      unique.push({ key: s.id, author: a });
      if (unique.length >= 20) break;
    }
    return unique;
  }, [stories]);

  return (
    <SafeAreaView className="flex-1 bg-[#000000]">
      {/* --- Header --- */}
      <View className="flex-row justify-between items-center px-6 py-4">
        <Text className="text-white text-3xl font-spaceBold">Skiix</Text>
        <View className="flex-row gap-5 items-center">
          <View className="relative">
            <TouchableOpacity hitSlop={10} onPress={() => router.push("/notifications")}>
              <Feather name="bell" size={24} color="white" />
            </TouchableOpacity>
            {notifUnread > 0 ? (
              <View className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full bg-[#FF4D6D] items-center justify-center px-1 border border-black">
                <Text className="text-white text-[10px] font-spaceBold">
                  {notifUnread > 99 ? "99+" : String(notifUnread)}
                </Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity hitSlop={8} onPress={() => router.push("/messages-inbox")}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* --- Stories Section --- */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="pl-6 mb-6"
        >
          {/* You (+) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/create-story")}
            className="items-center mr-5"
          >
            <View className="p-1 rounded-full border-2 border-transparent">
              <Image
                source={{
                  uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    email || "You",
                  )}&background=0A0F12&color=70DAFF`,
                }}
                className="w-16 h-16 rounded-full"
              />
              <View className="absolute bottom-0 right-0 bg-[#00E5FF] rounded-full border-2 border-black">
                <Ionicons name="add" size={16} color="black" />
              </View>
            </View>
            <Text className="text-[#94A3BB] text-[10px] mt-2 font-space">
              You
            </Text>
          </TouchableOpacity>

          {storiesLoading ? (
            <View className="justify-center pr-6">
              <ActivityIndicator color="#00E5FF" />
            </View>
          ) : (
            storyRow.map((s) => (
              <View key={s.key} className="items-center mr-5">
                <View className="p-1 rounded-full border-2 border-[#00E5FF]">
                  <Image
                    source={{
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        s.author,
                      )}&background=0A0F12&color=70DAFF`,
                    }}
                    className="w-16 h-16 rounded-full"
                  />
                </View>
                <Text className="text-[#94A3BB] text-[10px] mt-2 font-space">
                  @{s.author.split("@")[0]}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        {/* --- Dynamic Content Section --- */}
        {loading ? (
          <View className="mx-6 mt-4 items-center">
            <ActivityIndicator color="#00E5FF" />
          </View>
        ) : items.length === 0 ? (
          <View className="mx-6 mt-6 p-6 rounded-[28px] border border-[#FFFFFF1A] bg-[#FFFFFF08]">
            <Text className="text-white font-spaceBold text-base mb-2">
              No posts yet
            </Text>
            <Text className="text-[#FFFFFF66] font-space text-sm leading-6">
              Create the first post from the Quick Create button.
            </Text>
          </View>
        ) : (
          items.map((post) => {
            const mine =
              !!email &&
              (post.author_email || "").toLowerCase() === email.toLowerCase();
            const showProjectCta = (post.type ?? (post.is_project ? "project" : "text")) === "project";
            const joined = post.is_joined === true;
            const following = post.is_following === true;
            const ctaBusy = ctaBusyId === post.id;
            return (
          <TouchableOpacity
            key={post.id}
            activeOpacity={0.9}
            onPress={() => null}
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
            className="mx-6 p-5 rounded-[32px] border border-[#FFFFFF1A] mb-4"
          >
            {/* User Header */}
            <View className="flex-row items-center mb-4">
              <Image
                source={{
                  uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    post.author_email || "Skiix",
                  )}&background=0A0F12&color=70DAFF`,
                }}
                className="w-10 h-10 rounded-full"
              />
              <View className="ml-3">
                <View className="flex-row items-center">
                  <Text className="text-white font-spaceBold">
                    {post.author_email?.split("@")[0] || "User"}
                  </Text>
                  <MaterialCommunityIcons
                    name="check-decagram"
                    size={14}
                    color="#00E5FF"
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </View>
            </View>

            {/* Post Content */}
            <Text className="text-[#FFFFFFE5] font-space text-sm leading-6 mb-4">
              {post.content}
            </Text>

            {/* Media (image/video URL stored in image_url for now) */}
            {(post.media_url || post.image_url) ? (
              <View className="w-full h-48 bg-[#1A1A1A] rounded-2xl overflow-hidden mb-4">
                <Image
                  source={{ uri: post.media_url || post.image_url || "" }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* Footer Actions */}
            <View className="flex-row justify-between items-center">
              <View className="flex-row gap-6">
                <TouchableOpacity className="flex-row items-center">
                  <Feather name="heart" size={20} color="white" />
                  <Text className="text-[#FFFFFF66] text-xs ml-2">
                    {post.like_count ?? 0}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center">
                  <Feather name="message-square" size={20} color="white" />
                  <Text className="text-[#FFFFFF66] text-xs ml-2">
                    {post.comment_count ?? 0}
                  </Text>
                </TouchableOpacity>
                <Feather name="share-2" size={20} color="white" />
              </View>

              {!mine ? (
              <TouchableOpacity
                disabled={!email || ctaBusy || (showProjectCta ? joined : following)}
                onPress={async () => {
                  if (!email) return;
                  try {
                    setCtaBusyId(post.id);
                    if (showProjectCta) {
                      const projectId = (post.project_id || post.id) as string;
                      // optimistic
                      setItems((prev) =>
                        prev.map((p) => (p.id === post.id ? { ...p, is_joined: true } : p)),
                      );
                      await projectsApi.join({ user_email: email, project_id: projectId });
                    } else {
                      const toEmail = (post.author_email || "").toLowerCase();
                      if (!toEmail || toEmail === email.toLowerCase()) return;
                      // optimistic
                      setItems((prev) =>
                        prev.map((p) => (p.id === post.id ? { ...p, is_following: true } : p)),
                      );
                      await followApi.follow({ follower_email: email, following_email: toEmail });
                    }
                  } catch {
                    // rollback
                    setItems((prev) =>
                      prev.map((p) =>
                        p.id === post.id
                          ? { ...p, is_joined: joined, is_following: following }
                          : p,
                      ),
                    );
                  } finally {
                    setCtaBusyId(null);
                  }
                }}
                className={
                  showProjectCta
                    ? "bg-[#1A2E35] px-5 py-2.5 rounded-full border border-[#00E5FF33]"
                    : "bg-[#00E5FF] px-5 py-2.5 rounded-full"
                }
                activeOpacity={0.85}
              >
                <Text
                  className={
                    showProjectCta
                      ? "text-[#00E5FF] font-spaceBold text-xs"
                      : "text-white font-spaceBold text-xs"
                  }
                >
                  {ctaBusy
                    ? "..."
                    : showProjectCta
                      ? joined
                        ? "Joined"
                        : "Join Project"
                      : following
                        ? "Following"
                        : "Follow"}
                </Text>
              </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
