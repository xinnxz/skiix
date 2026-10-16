import { InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/utils/axiosInstance";
import type { HomeFeedPost } from "@/types/homeFeed.types";

const PAGE_SIZE = 20;

type FeedPage = { items: HomeFeedPost[]; nextOffset: number | null };
type FeedInfinite = InfiniteData<FeedPage, number>;

export const homeFeedKeys = {
  all: ["home-feed"] as const,
  list: (email: string) => [...homeFeedKeys.all, email] as const,
};

async function fetchHomeFeedPage(
  email: string,
  offset: number,
): Promise<{ items: HomeFeedPost[]; nextOffset: number | null }> {
  const res = await apiClient.get<{ data: HomeFeedPost[] }>("/api/v1/feed", {
    params: { limit: PAGE_SIZE, offset, viewer_email: email || undefined },
  });
  const items = res.data.data ?? [];
  return {
    items,
    nextOffset: items.length >= PAGE_SIZE ? offset + PAGE_SIZE : null,
  };
}

export function useHomeFeed(email: string) {
  return useInfiniteQuery({
    queryKey: homeFeedKeys.list(email),
    queryFn: ({ pageParam = 0 }) => fetchHomeFeedPage(email, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePatchHomeFeedPost(email: string) {
  const qc = useQueryClient();
  return (postId: string, patch: Partial<HomeFeedPost>) => {
    qc.setQueryData<FeedInfinite>(homeFeedKeys.list(email), (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
        })),
      };
    });
  };
}

export function usePrependHomeFeedPost(email: string) {
  const qc = useQueryClient();
  return (post: HomeFeedPost) => {
    qc.setQueryData<FeedInfinite>(homeFeedKeys.list(email), (old) => {
      if (!old?.pages?.length) {
        return {
          pages: [{ items: [post], nextOffset: null }],
          pageParams: [0],
        };
      }
      const first = old.pages[0];
      const exists = old.pages.some((pg) => pg.items.some((p) => p.id === post.id));
      if (exists) return old;
      return {
        ...old,
        pages: [{ ...first, items: [post, ...first.items] }, ...old.pages.slice(1)],
      };
    });
  };
}
