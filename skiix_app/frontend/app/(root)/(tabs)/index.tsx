import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useAuth } from "@/store/auth.store";
import type { StoryRingBucketDTO } from "@/utils/stories.api";
import { useStoryRing } from "@/hooks/useStoryRing";
import { toast } from "sonner-native";
import { useFocusEffect } from "@react-navigation/native";
import { countUnreadNotifications, subscribeToNotifications } from "@/services/appNotifications";
import { supabase } from "@/lib/supabase";
import type { HomeFeedPost } from "@/types/homeFeed.types";
import { HomeFeedPostCard } from "@/components/feed/home/HomeFeedPostCard";
import { ShuffleButton } from "@/components/feed/home/ShuffleButton";
import { SparkModal } from "@/components/feed/home/SparkModal";
import {
  mvpFeaturesApi,
  shufflePostToFeedItem,
  type SparkCard,
  type SparkChoices,
} from "@/utils/mvpFeatures.api";
import { trackAnalytics } from "@/utils/analytics";
import {
  useHomeFeed,
  usePatchHomeFeedPost,
  usePrependHomeFeedPost,
} from "@/hooks/useHomeFeed";
import { fetchInboxUnreadCount } from "@/services/conversationsService";
import { connectMessagingSocket, onMessagingEvent } from "@/services/messagingSocket";

export default function FeedScreen() {
  const { user, session } = useAuth();
  const email = user?.email ?? "";

  const [notifUnread, setNotifUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const storyRingQuery = useStoryRing(email);
  const storyBuckets = storyRingQuery.data ?? [];
  const storiesLoading = storyRingQuery.isLoading;
  const [shuffleLoading, setShuffleLoading] = useState(false);
  const [sparkOpen, setSparkOpen] = useState(false);
  const [sparkLoading, setSparkLoading] = useState(false);
  const [sparkChoices, setSparkChoices] = useState<SparkChoices | null>(null);

  const feedQuery = useHomeFeed(email);
  const patchPost = usePatchHomeFeedPost(email);
  const prependPost = usePrependHomeFeedPost(email);

  const items = useMemo(
    () => feedQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [feedQuery.data],
  );

  const refreshNotifUnread = useCallback(async () => {
    if (!user?.id) {
      setNotifUnread(0);
      setMsgUnread(0);
      return;
    }
    const [c, m] = await Promise.all([
      countUnreadNotifications(user.id),
      fetchInboxUnreadCount().catch(() => 0),
    ]);
    setNotifUnread(c);
    setMsgUnread(m);
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

  useEffect(() => {
    if (!session?.access_token) return;
    connectMessagingSocket(session.access_token);
    const unsub = onMessagingEvent(() => void refreshNotifUnread());
    return unsub;
  }, [session?.access_token, refreshNotifUnread]);

  const handleShuffle = useCallback(async () => {
    setShuffleLoading(true);
    try {
      const raw = await mvpFeaturesApi.fetchShuffle(email);
      void trackAnalytics("shuffle_tap");
      if (!raw?.id) {
        toast.message("No new shuffle content right now.");
        return;
      }
      const post = shufflePostToFeedItem(raw);
      prependPost(post);
      void trackAnalytics("shuffle_open", { post_id: post.id });
      toast.success("Shuffled — new discovery at the top");
    } catch {
      toast.error("Shuffle failed. Check your connection.");
    } finally {
      setShuffleLoading(false);
    }
  }, [email, prependPost]);

  const openSpark = useCallback(async () => {
    setSparkOpen(true);
    setSparkLoading(true);
    try {
      const choices = await mvpFeaturesApi.fetchSpark(email);
      setSparkChoices(choices);
      void trackAnalytics("spark_open");
    } catch {
      setSparkChoices(null);
      toast.error("Could not load Spark choices.");
    } finally {
      setSparkLoading(false);
    }
  }, [email]);

  const handleSparkSelect = useCallback(
    async (card: SparkCard) => {
      setSparkOpen(false);
      try {
        await mvpFeaturesApi.selectSpark(card.category, card.post_id);
        void trackAnalytics("spark_select", { category: card.category, post_id: card.post_id });
      } catch {
        /* non-blocking */
      }
      router.push(`/posts/${card.post_id}` as never);
    },
    [],
  );

  const patchPostHandler = useCallback(
    (
      postId: string,
      patch: Partial<HomeFeedPost> | ((prev: HomeFeedPost) => Partial<HomeFeedPost>),
    ) => {
      const current = items.find((p) => p.id === postId);
      if (!current) return;
      const delta = typeof patch === "function" ? patch(current) : patch;
      patchPost(postId, delta);
    },
    [items, patchPost],
  );

  const listHeader = (
    <View>
      <View className="flex-row justify-between items-center px-6 py-4">
        <Text className="text-white text-3xl font-spaceBold">Skiix</Text>
        <View className="flex-row gap-3 items-center">
          <ShuffleButton loading={shuffleLoading} onPress={() => void handleShuffle()} />
          <TouchableOpacity
            onPress={() => void openSpark()}
            activeOpacity={0.85}
            className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border border-[#F59E0B44] bg-[#1A1508]"
          >
            <Ionicons name="flash" size={16} color="#F59E0B" />
            <Text className="text-[#F59E0B] font-spaceBold text-xs">Spark</Text>
          </TouchableOpacity>
          <View className="relative">
            <TouchableOpacity hitSlop={10} onPress={() => router.push("/notifications")}>
              <Feather name="bell" size={22} color="white" />
            </TouchableOpacity>
            {notifUnread > 0 ? (
              <View className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full bg-[#FF4D6D] items-center justify-center px-1 border border-black">
                <Text className="text-white text-[10px] font-spaceBold">
                  {notifUnread > 99 ? "99+" : String(notifUnread)}
                </Text>
              </View>
            ) : null}
          </View>
          <View className="relative">
            <TouchableOpacity hitSlop={8} onPress={() => router.push("/messages-inbox")}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color="white" />
            </TouchableOpacity>
            {msgUnread > 0 ? (
              <View className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full bg-[#00E5FF] items-center justify-center px-1 border border-black">
                <Text className="text-black text-[10px] font-spaceBold">
                  {msgUnread > 99 ? "99+" : String(msgUnread)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="pl-6 mb-6"
      >
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
              style={{ width: 64, height: 64, borderRadius: 999 }}
              contentFit="cover"
            />
            <View className="absolute bottom-0 right-0 bg-[#00E5FF] rounded-full border-2 border-black">
              <Ionicons name="add" size={16} color="black" />
            </View>
          </View>
          <Text className="text-[#94A3BB] text-[10px] mt-2 font-space">You</Text>
        </TouchableOpacity>

        {storiesLoading ? (
          <View className="justify-center pr-6">
            <ActivityIndicator color="#00E5FF" />
          </View>
        ) : (
          storyBuckets.map((b) => {
            const ring = b.has_unseen ? "#00E5FF" : "rgba(255,255,255,0.25)";
            return (
              <TouchableOpacity
                key={b.username + b.user_id}
                activeOpacity={0.88}
                className="items-center mr-5"
                onPress={() => {
                  if (!b.user_id) {
                    toast.error("Story unavailable for this user.");
                    return;
                  }
                  router.push(`/stories/${b.user_id}` as never);
                }}
              >
                <View className="p-1 rounded-full" style={{ borderWidth: 2, borderColor: ring }}>
                  <Image
                    source={{ uri: b.avatar_url }}
                    style={{ width: 64, height: 64, borderRadius: 999 }}
                    contentFit="cover"
                    recyclingKey={b.username}
                  />
                </View>
                <Text className="text-[#94A3BB] text-[10px] mt-2 font-space text-center">
                  @{b.username}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const listEmpty = feedQuery.isLoading ? (
    <View className="mx-6 mt-4 items-center py-12">
      <ActivityIndicator color="#00E5FF" />
    </View>
  ) : (
    <View className="mx-6 mt-2 p-6 rounded-[28px] border border-[#FFFFFF1A] bg-[#FFFFFF08]">
      <Text className="text-white font-spaceBold text-base mb-2">No posts yet</Text>
      <Text className="text-[#FFFFFF66] font-space text-sm leading-6">
        Tap Shuffle or Spark to discover content, or create the first post.
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#000000]">
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl
            refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
            onRefresh={() => void feedQuery.refetch()}
            tintColor="#00E5FF"
          />
        }
        onEndReached={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            void feedQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          feedQuery.isFetchingNextPage ? (
            <View className="py-6 items-center">
              <ActivityIndicator color="#00E5FF" />
            </View>
          ) : (
            <View style={{ height: 100 }} />
          )
        }
        renderItem={({ item }) => (
          <HomeFeedPostCard
            post={item}
            viewerEmail={email}
            onPatchPost={patchPostHandler}
          />
        )}
      />

      <SparkModal
        visible={sparkOpen}
        loading={sparkLoading}
        choices={sparkChoices}
        onClose={() => setSparkOpen(false)}
        onSelect={(card) => void handleSparkSelect(card)}
      />
    </SafeAreaView>
  );
}
