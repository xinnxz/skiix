import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";

import { CategoryFilter } from "@/components/explore/CategoryFilter";
import { ExploreCard } from "@/components/explore/ExploreCard";
import { SkeletonGrid } from "@/components/explore/SkeletonGrid";
import { SearchResultsList } from "@/components/explore/SearchResults";
import { QuickCreateSheet } from "@/components/QuickCreateSheet";
import {
  type ExploreCard as ExploreCardData,
  type ExploreCategoryId,
} from "@/services/exploreService";
import {
  useDebouncedValue,
  useExploreGrid,
  useSearch,
} from "@/hooks/useExplore";

const TOKENS = {
  bg: "#0A0A0A",
  card: "#111111",
  border: "#1F1F1F",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
  placeholder: "#555555",
  iconMuted: "#888888",
};

const { width } = Dimensions.get("window");
const GRID_PAD = 12;
const GRID_GAP = 10;
const COLUMN_WIDTH = (width - GRID_PAD * 2 - GRID_GAP) / 2;

export default function ExploreScreen() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExploreCategoryId>("all");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 400);
  const isSearching = debouncedQuery.trim().length > 0;

  const search = useSearch(debouncedQuery);
  const grid = useExploreGrid(category);

  const allCards: ExploreCardData[] = useMemo(
    () => grid.data?.pages.flatMap((p) => p.data) ?? [],
    [grid.data],
  );

  const { leftColumn, rightColumn } = useMemo(() => {
    const left: ExploreCardData[] = [];
    const right: ExploreCardData[] = [];
    let leftHeight = 0;
    let rightHeight = 0;
    for (const card of allCards) {
      if (leftHeight <= rightHeight) {
        left.push(card);
        leftHeight += card.height;
      } else {
        right.push(card);
        rightHeight += card.height;
      }
    }
    return { leftColumn: left, rightColumn: right };
  }, [allCards]);

  const handleEndReached = useCallback(() => {
    if (grid.hasNextPage && !grid.isFetchingNextPage) {
      grid.fetchNextPage();
    }
  }, [grid]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const distance =
        contentSize.height - (layoutMeasurement.height + contentOffset.y);
      if (distance < 400) handleEndReached();
    },
    [handleEndReached],
  );

  const handleCardPress = useCallback((card: ExploreCardData) => {
    const linked = card.linked_id || card.id;
    const postId = card.post_id || card.id;

    if (__DEV__) {
      console.log("[Explore] tap", card.type, { linked, postId });
    }

    switch (card.type) {
      case "project":
        router.push(`/projects/${linked}` as Href);
        break;
      case "user":
        router.push(`/profile/${linked}` as Href);
        break;
      case "project_post":
      case "project_update":
        router.push({
          pathname: "/posts/[id]",
          params: { id: postId, projectId: linked },
        } as Href);
        break;
      case "post":
      case "topic":
      default:
        router.push({
          pathname: "/posts/[id]",
          params: { id: postId },
        } as Href);
        break;
    }
  }, []);

  const handleQuickAction = useCallback((action: "reel" | "text" | "story" | "project") => {
    setQuickCreateOpen(false);
    if (action === "story") router.push("/create-story");
    if (action === "project") router.push("/create-project-update");
    if (action === "text") router.push("/create-text");
    if (action === "reel") router.push("/create-reel");
  }, []);

  const showSkeleton = grid.isLoading && allCards.length === 0;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Ionicons
            name="search-outline"
            size={20}
            color={TOKENS.iconMuted}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search builders, projects..."
            placeholderTextColor={TOKENS.placeholder}
            value={query}
            onChangeText={setQuery}
            selectionColor={TOKENS.cyan}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={10}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color="#666666" />
            </TouchableOpacity>
          ) : null}
        </View>

        {isSearching ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
          >
            <SearchResultsList
              query={debouncedQuery}
              results={search.data}
              isLoading={search.isLoading || search.isFetching}
              onSelectProject={(id) => router.push(`/projects/${id}` as Href)}
              onSelectUser={(username) =>
                router.push(`/profile/${username}` as Href)
              }
              onSelectPost={(id) => router.push(`/posts/${id}` as Href)}
            />
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={32}
            contentContainerStyle={{ paddingBottom: 140 }}
          >
            <View style={{ marginBottom: 16 }}>
              <CategoryFilter activeId={category} onChange={setCategory} />
            </View>

            {showSkeleton ? (
              <SkeletonGrid columnWidth={COLUMN_WIDTH} />
            ) : allCards.length === 0 ? (
              <View style={styles.gridEmpty}>
                <Ionicons name="grid-outline" size={42} color="#333333" />
                <Text style={styles.gridEmptyTitle}>Nothing here yet</Text>
                <Text style={styles.gridEmptySub}>
                  Try a different category.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                <View style={[styles.column, { width: COLUMN_WIDTH }]}>
                  {leftColumn.map((card) => (
                    <ExploreCard
                      key={card.id}
                      card={card}
                      width={COLUMN_WIDTH}
                      onPress={handleCardPress}
                    />
                  ))}
                </View>
                <View style={[styles.column, { width: COLUMN_WIDTH }]}>
                  {rightColumn.map((card) => (
                    <ExploreCard
                      key={card.id}
                      card={card}
                      width={COLUMN_WIDTH}
                      onPress={handleCardPress}
                    />
                  ))}
                </View>
              </View>
            )}

            {grid.isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={TOKENS.cyan} />
              </View>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Cyan FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setQuickCreateOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Quick create"
      >
        <Ionicons name="add" size={26} color="#000000" />
      </TouchableOpacity>

      <QuickCreateSheet
        visible={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onSelect={handleQuickAction}
        onOpenDrafts={() => {
          setQuickCreateOpen(false);
          router.push("/drafts");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.bg },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: TOKENS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: TOKENS.text,
    fontSize: 15,
    padding: 0,
  },
  grid: {
    flexDirection: "row",
    paddingHorizontal: GRID_PAD,
    gap: GRID_GAP,
  },
  column: { flex: 1 },
  gridEmpty: {
    paddingTop: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  gridEmptyTitle: {
    color: TOKENS.text,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  gridEmptySub: { color: TOKENS.textMuted, fontSize: 13 },
  footerLoader: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: Platform.OS === "ios" ? 108 : 92,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: TOKENS.cyan,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TOKENS.cyan,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
    zIndex: 60,
  },
});
