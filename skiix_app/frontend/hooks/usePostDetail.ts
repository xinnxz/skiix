import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HomeFeedPost } from "@/types/homeFeed.types";
import { postDetailApi, type PostDetailDTO } from "@/utils/postDetail.api";

export const postDetailKeys = {
  all: ["post-detail"] as const,
  detail: (id: string) => [...postDetailKeys.all, id] as const,
};

export function homeFeedPostToDetailSeed(post: HomeFeedPost): PostDetailDTO {
  return {
    id: post.id,
    type: post.type ?? "text",
    content: post.content ?? "",
    media_url: (post.media_url || post.image_url || "") as string,
    media_type: post.media_type === "video" ? "video" : "image",
    thumbnail_url: post.thumbnail_url ?? undefined,
    tags: post.tags ?? [],
    location: "",
    created_at: post.created_at,
    likes_count: post.like_count ?? 0,
    comments_count: post.comment_count ?? 0,
    is_liked: post.is_liked ?? false,
    is_saved: post.is_saved ?? false,
    is_following: post.is_following ?? false,
    is_own_post: post.is_own_post ?? false,
    project_id: post.project_id,
    project_name: post.project_name,
    is_new_project: post.is_new_project,
    metrics: post.metrics ?? undefined,
    is_joined: post.is_joined,
    user_id: post.user_id,
    username: post.author_username ?? "",
    full_name: post.author_username ?? "",
    avatar_url: "",
    role_tag: "",
    is_verified: post.is_verified ?? false,
    extra_media_urls: post.extra_media_urls ?? [],
    viewer_vibe_score: post.viewer_vibe_score,
    vibe_love_pct: post.vibe_love_pct,
    vibe_neutral_pct: post.vibe_neutral_pct,
    vibe_disagree_pct: post.vibe_disagree_pct,
    avg_vibe_score: post.avg_vibe_score,
    vibe_count: post.vibe_count,
    saves_count: post.saves_count,
  };
}

export function usePostDetail(postId: string, seed?: PostDetailDTO) {
  return useQuery({
    queryKey: postDetailKeys.detail(postId),
    queryFn: () => postDetailApi.getPost(postId),
    enabled: Boolean(postId?.trim()),
    initialData: seed,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePatchPostDetail(postId: string) {
  const qc = useQueryClient();
  return (patch: Partial<PostDetailDTO>) => {
    qc.setQueryData<PostDetailDTO>(postDetailKeys.detail(postId), (old) =>
      old ? { ...old, ...patch } : old,
    );
  };
}

export function useTogglePostDetailLike(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postDetailApi.toggleLike(postId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: postDetailKeys.detail(postId) });
      const prev = qc.getQueryData<PostDetailDTO>(postDetailKeys.detail(postId));
      if (prev) {
        const nextLiked = !prev.is_liked;
        qc.setQueryData<PostDetailDTO>(postDetailKeys.detail(postId), {
          ...prev,
          is_liked: nextLiked,
          likes_count: Math.max(0, prev.likes_count + (nextLiked ? 1 : -1)),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(postDetailKeys.detail(postId), ctx.prev);
    },
  });
}
