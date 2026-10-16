import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reelsService, type ReelsPage, type ReelView } from "@/services/reelsService";
import { useReelsStore } from "@/store/reelsStore";
import { useAuth } from "@/store/auth.store";

const queryKeyFor = (tab: "for-you" | "following") =>
  ["reels", tab] as const;

/** Infinite reels feed scoped to the active tab. */
export function useReels() {
  const activeTab = useReelsStore((s) => s.activeTab);

  const query = useInfiniteQuery<ReelsPage>({
    queryKey: queryKeyFor(activeTab),
    queryFn: ({ pageParam }) =>
      reelsService.fetchReels({
        tab: activeTab,
        cursor: (pageParam as string | null | undefined) ?? null,
      }),
    initialPageParam: null,
    getNextPageParam: (last) => (last.has_more ? (last.cursor ?? undefined) : undefined),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const reels = query.data?.pages.flatMap((p) => p.data) ?? [];

  return {
    reels,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}

/**
 * Optimistic like / save / follow mutations for the active tab.
 *
 * `like` and `save` toggle the corresponding state via the backend's
 * idempotent endpoints; on the server's authoritative response we reconcile
 * the count so transient drift (e.g. another viewer liking simultaneously)
 * resolves on the next interaction.
 *
 * `follow` is one-way — the sidebar `+` badge collapses to `✓` after the call
 * resolves and never reverts. The mutation requires the viewer's email which
 * the backend uses to resolve the follower row (the Supabase JWT only carries
 * email, not the Skiix user UUID).
 */
export function useReelInteractions(activeTab: "for-you" | "following") {
  const qc = useQueryClient();
  const { user } = useAuth();
  const viewerEmail = (user?.email ?? "").trim().toLowerCase();

  const patchReel = (reelId: string, patch: Partial<ReelView>) => {
    qc.setQueryData<{ pages: ReelsPage[]; pageParams: unknown[] } | undefined>(
      queryKeyFor(activeTab),
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((r) =>
              r.id === reelId ? { ...r, ...patch } : r,
            ),
          })),
        };
      },
    );
  };

  const patchAllReelsByUser = (userId: string, patch: Partial<ReelView>) => {
    for (const tab of ["for-you", "following"] as const) {
      qc.setQueryData<{ pages: ReelsPage[]; pageParams: unknown[] } | undefined>(
        queryKeyFor(tab),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((r) =>
                r.user_id === userId ? { ...r, ...patch } : r,
              ),
            })),
          };
        },
      );
    }
  };

  const like = useMutation({
    mutationFn: ({ reel }: { reel: ReelView }) =>
      reelsService.toggleLike(reel.id, reel.is_liked),
    onMutate: ({ reel }) => {
      patchReel(reel.id, {
        is_liked: !reel.is_liked,
        likes_count: reel.is_liked
          ? Math.max(0, reel.likes_count - 1)
          : reel.likes_count + 1,
      });
      return { prev: reel };
    },
    onSuccess: (result, { reel }) => {
      if (!result) return;
      patchReel(reel.id, {
        is_liked: result.is_liked,
        likes_count: result.like_count,
      });
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) {
        patchReel(ctx.prev.id, {
          is_liked: ctx.prev.is_liked,
          likes_count: ctx.prev.likes_count,
        });
      }
    },
  });

  const save = useMutation({
    mutationFn: ({ reel }: { reel: ReelView }) =>
      reelsService.toggleSave(reel.id, reel.is_saved),
    onMutate: ({ reel }) => {
      patchReel(reel.id, {
        is_saved: !reel.is_saved,
        saves_count: reel.is_saved
          ? Math.max(0, reel.saves_count - 1)
          : reel.saves_count + 1,
      });
      return { prev: reel };
    },
    onSuccess: (result, { reel }) => {
      if (!result) return;
      patchReel(reel.id, {
        is_saved: result.saved,
        saves_count: result.saves_count,
      });
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) {
        patchReel(ctx.prev.id, {
          is_saved: ctx.prev.is_saved,
          saves_count: ctx.prev.saves_count,
        });
      }
    },
  });

  const follow = useMutation({
    mutationFn: ({ reel }: { reel: ReelView }) => {
      if (reel.is_following_author || !viewerEmail || !reel.user_id) {
        return Promise.resolve();
      }
      return reelsService.followAuthor({
        followerEmail: viewerEmail,
        followingUserId: reel.user_id,
      });
    },
    onMutate: ({ reel }) => {
      patchAllReelsByUser(reel.user_id, {
        is_following_author: true,
      });
      return { prev: reel };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) {
        patchAllReelsByUser(ctx.prev.user_id, {
          is_following_author: ctx.prev.is_following_author,
        });
      }
    },
  });

  return { like, save, follow };
}
