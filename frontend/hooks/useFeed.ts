import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import { PostFeedResponseDTO, CreatePostRequestDTO } from "@/types/post.types";
import { ReelFeedResponseDTO } from "@/types/index";
import { postsApi, reelsApi } from "@/utils/post.api";

// ─── Query Keys ──────────────────────────────────────────────
export const queryKeys = {
  feed: (type: string) => ["feed", type] as const,
  post: (id: string) => ["post", id] as const,
  postComments: (id: string) => ["post", id, "comments"] as const,
  userPosts: (userId: string) => ["userPosts", userId] as const,
  reelFeed: () => ["reels", "feed"] as const,
  reel: (id: string) => ["reel", id] as const,
  reelComments: (id: string) => ["reel", id, "comments"] as const,
  user: (username: string) => ["user", username] as const,
  me: () => ["me"] as const,
  notifications: () => ["notifications"] as const,
  conversations: () => ["conversations"] as const,
  messages: (convoId: string) => ["messages", convoId] as const,
  suggestions: () => ["suggestions"] as const,
  trendingHashtags: () => ["trending", "hashtags"] as const,
};

// ─── Feed Hooks ──────────────────────────────────────────────

/** Paginated post feed */
export function useFeed(
  feedType: "for_you" | "following" | "trending" = "for_you",
) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed(feedType),
    queryFn: ({ pageParam }) =>
      postsApi.getFeed({
        cursor: pageParam as string | undefined,
        feed_type: feedType,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: PostFeedResponseDTO) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
    staleTime: 60_000, // 1 min
  });
}

/** All posts flattened from infinite query */
export function useFlatPosts(
  feedType: "for_you" | "following" | "trending" = "for_you",
) {
  const query = useFeed(feedType);
  const posts = query.data?.pages.flatMap((p) => p.posts) ?? [];
  return { ...query, posts };
}

/** Single post */
export function usePost(id: string) {
  return useQuery({
    queryKey: queryKeys.post(id),
    queryFn: () => postsApi.getPost(id),
    enabled: !!id,
  });
}

/** Create post mutation */
export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePostRequestDTO) => postsApi.createPost(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feed("for_you") });
      qc.invalidateQueries({ queryKey: queryKeys.feed("following") });
    },
  });
}

/** Toggle post like mutation (optimistic) */
export function useTogglePostLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      postsApi.toggleLike(id, liked),
    onMutate: async ({ id, liked }) => {
      // Optimistic update across all feed pages
      await qc.cancelQueries({ queryKey: ["feed"] });
      const previous = qc.getQueryData(queryKeys.post(id));
      qc.setQueryData(queryKeys.post(id), (old: any) =>
        old
          ? {
              ...old,
              is_liked: !liked,
              like_count: liked ? old.like_count - 1 : old.like_count + 1,
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, { id }, ctx) => {
      qc.setQueryData(queryKeys.post(id), ctx?.previous);
    },
  });
}

/** Toggle post bookmark */
export function useTogglePostBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bookmarked }: { id: string; bookmarked: boolean }) =>
      postsApi.toggleBookmark(id, bookmarked),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.post(id) });
    },
  });
}

// ─── Reel Hooks ──────────────────────────────────────────────

/** Infinite reel feed */
export function useReelFeed() {
  return useInfiniteQuery({
    queryKey: queryKeys.reelFeed(),
    queryFn: ({ pageParam }) =>
      reelsApi.getReelFeed(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ReelFeedResponseDTO) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
    staleTime: 30_000,
  });
}

/** Flat reels */
export function useFlatReels() {
  const query = useReelFeed();
  const reels = query.data?.pages.flatMap((p) => p.reels) ?? [];
  return { ...query, reels };
}

/** Toggle reel like (optimistic) */
export function useToggleReelLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      reelsApi.toggleLike(id, liked),
    onMutate: async ({ id, liked }) => {
      qc.setQueriesData<InfiniteData<ReelFeedResponseDTO>>(
        { queryKey: queryKeys.reelFeed() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              reels: page.reels.map((reel) =>
                reel.id === id
                  ? {
                      ...reel,
                      is_liked: !liked,
                      like_count: liked
                        ? reel.like_count - 1
                        : reel.like_count + 1,
                    }
                  : reel,
              ),
            })),
          };
        },
      );
    },
  });
}

// ─── Post Comments ───────────────────────────────────────────
export function usePostComments(postId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.postComments(postId),
    queryFn: ({ pageParam }) =>
      postsApi.getComments(postId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.has_more ? (page.next_cursor ?? undefined) : undefined,
    enabled: !!postId,
  });
}
