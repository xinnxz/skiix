import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Platform,
  ActionSheetIOS,
  Alert,
  Share,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, type Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { toast } from "sonner-native";

import { ReelItem } from "@/components/reels/ReelItem";
import { ReelsHeader } from "@/components/reels/ReelsHeader";
import { CommentsSheet } from "@/components/reels/CommentsSheet";
import { useReels, useReelInteractions } from "@/hooks/useReels";
import { useReelsStore } from "@/store/reelsStore";
import type { ReelView } from "@/services/reelsService";
import { profilePathFromIds } from "@/utils/profileNav";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const activeIndex = useReelsStore((s) => s.activeIndex);
  const setActiveIndex = useReelsStore((s) => s.setActiveIndex);
  const activeTab = useReelsStore((s) => s.activeTab);

  const { reels, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useReels();
  const { like, save, follow } = useReelInteractions(activeTab);

  const [commentReelId, setCommentReelId] = useState<string | null>(null);
  const listRef = useRef<FlatList<ReelView>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const next = viewableItems[0].index ?? 0;
        setActiveIndex(next);
      }
    },
  ).current;

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 70,
      minimumViewTime: 80,
    }),
    [],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleLike = useCallback(
    (reel: ReelView) => like.mutate({ reel }),
    [like],
  );
  const handleSave = useCallback(
    (reel: ReelView) => save.mutate({ reel }),
    [save],
  );
  const handleFollow = useCallback(
    (reel: ReelView) => follow.mutate({ reel }),
    [follow],
  );
  const handleComment = useCallback((reel: ReelView) => {
    setCommentReelId(reel.id);
  }, []);
  const handleJoinProject = useCallback((reel: ReelView) => {
    if (reel.project_id) {
      router.push(`/projects/${reel.project_id}` as Href);
    }
  }, []);
  const handleHashtagPress = useCallback((tag: string) => {
    const clean = tag.replace(/^#/, "");
    router.push(`/search?tag=${encodeURIComponent(clean)}` as Href);
  }, []);
  const handleAvatarPress = useCallback((reel: ReelView) => {
    const href = profilePathFromIds(reel.user_id, reel.username?.trim());
    if (href) router.push(href);
  }, []);
  const handleShare = useCallback((reel: ReelView) => {
    const link = `https://skiix.app/reels/${reel.id}`;
    const copyLink = async () => {
      await Clipboard.setStringAsync(link);
      toast.success("Link copied");
    };
    const sendInSkiix = () => {
      router.push(
        `/forward-post?postId=${encodeURIComponent(reel.id)}` as Href,
      );
    };
    const shareTo = async () => {
      try {
        await Share.share({
          message: `Watch this on Skiix: ${link}`,
          url: link,
        });
      } catch {
        // user cancelled
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Copy link", "Send in Skiix", "Share to…"],
          cancelButtonIndex: 0,
          title: "Share Reel",
        },
        (idx) => {
          if (idx === 1) void copyLink();
          else if (idx === 2) sendInSkiix();
          else if (idx === 3) void shareTo();
        },
      );
    } else {
      Alert.alert("Share Reel", undefined, [
        { text: "Copy link", onPress: () => void copyLink() },
        { text: "Send in Skiix", onPress: sendInSkiix },
        { text: "Share to…", onPress: () => void shareTo() },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ReelView; index: number }) => (
      <ReelItem
        reel={item}
        index={index}
        activeIndex={activeIndex}
        topInset={insets.top + 48}
        bottomInset={insets.bottom}
        onLike={handleLike}
        onSave={handleSave}
        onFollow={handleFollow}
        onComment={handleComment}
        onShare={handleShare}
        onAvatarPress={handleAvatarPress}
        onJoinProject={handleJoinProject}
        onHashtagPress={handleHashtagPress}
      />
    ),
    [
      activeIndex,
      insets.top,
      insets.bottom,
      handleLike,
      handleSave,
      handleFollow,
      handleComment,
      handleShare,
      handleAvatarPress,
      handleJoinProject,
      handleHashtagPress,
    ],
  );

  const keyExtractor = useCallback((reel: ReelView) => reel.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<ReelView> | null | undefined, index: number) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent />

      <ReelsHeader topInset={insets.top} />

      {isLoading && reels.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#00E5FF" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={reels}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          pagingEnabled
          snapToInterval={SCREEN_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          removeClippedSubviews={false}
          windowSize={5}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          ItemSeparatorComponent={null}
        />
      )}

      {isFetchingNextPage ? (
        <View style={[styles.loadingMore, { bottom: insets.bottom + 100 }]}>
          <ActivityIndicator size="small" color="#00E5FF" />
        </View>
      ) : null}

      <CommentsSheet
        visible={!!commentReelId}
        reelId={commentReelId}
        onClose={() => setCommentReelId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingMore: {
    position: "absolute",
    alignSelf: "center",
  },
});
