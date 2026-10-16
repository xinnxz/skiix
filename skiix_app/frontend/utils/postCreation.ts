import { InfiniteData, QueryClient } from "@tanstack/react-query";
import { homeFeedKeys } from "@/hooks/useHomeFeed";
import type { HomeFeedPost } from "@/types/homeFeed.types";

type FeedInfinite = InfiniteData<{ items: HomeFeedPost[]; nextOffset: number | null }, number>;

export const storyRingKeys = {
  all: ["stories-ring"] as const,
  list: (email: string) => [...storyRingKeys.all, email] as const,
};

export type CreatedPostDTO = {
  id: string;
  user_id: string;
  type?: string;
  content?: string;
  media_url?: string | null;
  image_url?: string | null;
  is_project?: boolean;
  project_id?: string | null;
  is_new_project?: boolean;
  metrics?: string | null;
  milestone_type?: string | null;
  project_name?: string | null;
  thumbnail_url?: string | null;
  tags?: string[];
  extra_media_urls?: string[] | null;
  created_at?: string;
  updated_at?: string;
};

export function createdPostToFeedItem(
  post: CreatedPostDTO,
  viewer: { email: string; username?: string | null },
): HomeFeedPost {
  const now = new Date().toISOString();
  const media = post.media_url ?? post.image_url ?? null;
  return {
    id: post.id,
    user_id: post.user_id,
    content: post.content ?? "",
    media_url: media,
    image_url: post.image_url ?? media,
    is_project: post.is_project,
    type: (post.type as HomeFeedPost["type"]) ?? "text",
    project_id: post.project_id ?? null,
    is_new_project: post.is_new_project,
    metrics: post.metrics ?? null,
    milestone_type: post.milestone_type ?? null,
    project_name: post.project_name ?? null,
    like_count: 0,
    comment_count: 0,
    created_at: post.created_at ?? now,
    updated_at: post.updated_at ?? now,
    author_email: viewer.email,
    author_username: viewer.username ?? undefined,
    is_own_post: true,
    is_liked: false,
    is_saved: false,
    is_joined: false,
    is_following: false,
    thumbnail_url: post.thumbnail_url ?? null,
    tags: post.tags,
    extra_media_urls: post.extra_media_urls ?? null,
    media_type: media?.includes("/video/") ? "video" : media ? "image" : undefined,
  };
}

function prependToHomeFeed(qc: QueryClient, email: string, post: HomeFeedPost) {
  qc.setQueryData<FeedInfinite>(homeFeedKeys.list(email), (old) => {
    if (!old?.pages?.length) {
      return {
        pages: [{ items: [post], nextOffset: null }],
        pageParams: [0],
      };
    }
    const exists = old.pages.some((pg) => pg.items.some((p) => p.id === post.id));
    if (exists) return old;
    const first = old.pages[0];
    return {
      ...old,
      pages: [{ ...first, items: [post, ...first.items] }, ...old.pages.slice(1)],
    };
  });
}

/** Invalidate caches and optionally prepend the new post to the home feed. */
export async function refreshAfterPostCreate(
  qc: QueryClient,
  email: string,
  opts?: {
    createdPost?: CreatedPostDTO;
    username?: string | null;
    refreshStories?: boolean;
  },
) {
  if (__DEV__) {
    console.log("[PostCreate] refreshing caches", { email, postId: opts?.createdPost?.id });
  }

  const tasks: Promise<unknown>[] = [
    qc.invalidateQueries({ queryKey: homeFeedKeys.all }),
    qc.invalidateQueries({ queryKey: ["feed"] }),
    qc.invalidateQueries({ queryKey: ["reels"] }),
    qc.invalidateQueries({ queryKey: ["explore"] }),
  ];

  if (opts?.refreshStories && email) {
    tasks.push(qc.invalidateQueries({ queryKey: storyRingKeys.list(email) }));
  }

  await Promise.all(tasks);

  if (opts?.createdPost && email) {
    const feedItem = createdPostToFeedItem(opts.createdPost, {
      email,
      username: opts.username,
    });
    prependToHomeFeed(qc, email, feedItem);
  }
}
