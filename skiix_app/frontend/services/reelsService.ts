// ============================================================
// REELS SERVICE
//
// Adapts the backend's `/api/v1/reels` feed into the UI's `ReelView` shape.
// Likes / saves / comments / follows are all routed through the existing
// post + follow endpoints (`/api/v1/posts/:id/like`, `/api/v1/posts/:id/save`,
// `/api/v1/posts/:id/comments`, `/api/v1/follow`). A small set of curated
// fallback reels keeps the screen renderable while the backend is offline.
// ============================================================

import apiClient from "@/utils/axiosInstance";
import type { CommentDTO, PaginatedResponseDTO } from "@/types";

export type ReelsTab = "for-you" | "following";

/** UI-friendly view of a reel. */
export interface ReelView {
  id: string;
  video_url: string;
  thumbnail_url: string;
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url: string;
  role_tag: string;
  is_verified?: boolean;
  title: string;
  description: string;
  hashtags: string[];
  category?: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  is_liked: boolean;
  is_saved: boolean;
  is_following_author: boolean;
  is_own_post?: boolean;
  project_id?: string;
  video_duration?: number;
  created_at: string;
}

export interface ReelsPage {
  data: ReelView[];
  cursor: string | null;
  has_more: boolean;
}

// Shape returned by `GET /api/v1/reels`. Kept private — UI uses ReelView.
type ApiReelItem = {
  id: string;
  video_url: string;
  thumbnail_url: string;
  title: string;
  description: string;
  tags: string[] | null;
  category: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  role_tag: string;
  is_verified: boolean;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  is_liked: boolean;
  is_saved: boolean;
  is_following: boolean;
  is_own_post: boolean;
  project_id: string | null;
  video_duration: number;
  created_at: string;
};

type ApiReelsResponse = {
  data: ApiReelItem[];
  cursor: string | null;
  has_more: boolean;
};

function fallbackAvatar(username: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    username,
  )}&background=0A0F12&color=70DAFF`;
}

function adaptReel(item: ApiReelItem): ReelView {
  const username = item.username || "user";
  const titleRaw = item.title?.trim();
  const description = item.description?.trim() ?? "";
  const fallbackTitle = description.split(/\r?\n/)[0]?.slice(0, 60) || "Untitled";
  return {
    id: item.id,
    video_url: item.video_url,
    thumbnail_url: item.thumbnail_url || "",
    user_id: item.user_id,
    username,
    full_name: item.full_name || username,
    avatar_url: item.avatar_url || fallbackAvatar(username),
    role_tag: (item.role_tag || "BUILDER").toUpperCase(),
    is_verified: !!item.is_verified,
    title: titleRaw || fallbackTitle,
    description,
    hashtags: Array.isArray(item.tags) ? item.tags : [],
    category: item.category,
    likes_count: item.likes_count ?? 0,
    comments_count: item.comments_count ?? 0,
    saves_count: item.saves_count ?? 0,
    is_liked: !!item.is_liked,
    is_saved: !!item.is_saved,
    is_following_author: !!item.is_following,
    is_own_post: !!item.is_own_post,
    project_id: item.project_id ?? undefined,
    video_duration: item.video_duration ?? 0,
    created_at: item.created_at,
  };
}

// ─── Local fallback reels (used when API is unreachable) ──────────────────

const FALLBACK_VIDEO_URLS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
];

const FALLBACK_REELS: ReelView[] = [
  {
    id: "fallback-1",
    video_url: FALLBACK_VIDEO_URLS[0],
    thumbnail_url:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900",
    user_id: "u1",
    username: "alex_stark",
    avatar_url: "https://i.pravatar.cc/200?u=alex_stark",
    role_tag: "FOUNDER",
    title: "EcoTrack AI: Carbon Credits Simplified",
    description:
      "We're leveraging computer vision to track reforestation in real-time. Join the …",
    hashtags: ["#ClimateTech", "#SaaS"],
    likes_count: 12400,
    comments_count: 842,
    saves_count: 3100,
    is_liked: false,
    is_saved: false,
    is_following_author: false,
    project_id: "ecotrack",
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-2",
    video_url: FALLBACK_VIDEO_URLS[1],
    thumbnail_url:
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=900",
    user_id: "u2",
    username: "sarah_dev",
    avatar_url: "https://i.pravatar.cc/200?u=sarah_dev",
    role_tag: "ENGINEER",
    title: "Building the Future of Web3 Social",
    description:
      "Deep dive into decentralized identity protocols and why they matter for the next billion users.",
    hashtags: ["#Web3", "#Solidity"],
    likes_count: 8200,
    comments_count: 430,
    saves_count: 1200,
    is_liked: false,
    is_saved: false,
    is_following_author: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-3",
    video_url: FALLBACK_VIDEO_URLS[2],
    thumbnail_url:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900",
    user_id: "u3",
    username: "marcus_j",
    avatar_url: "https://i.pravatar.cc/200?u=marcus_j",
    role_tag: "DESIGNER",
    title: "UI Trends 2026: Beyond Glassmorphism",
    description:
      "Exploring spatial interfaces and generative UI components in mobile apps.",
    hashtags: ["#Design", "#UX"],
    likes_count: 15700,
    comments_count: 1100,
    saves_count: 5400,
    is_liked: false,
    is_saved: false,
    is_following_author: false,
    created_at: new Date().toISOString(),
  },
];

function isFallbackId(id: string): boolean {
  return id.startsWith("fallback-");
}

// ─── API ────────────────────────────────────────────────────────────────────

export const reelsService = {
  /**
   * Fetch the reels feed for the given tab.
   *
   * Pagination uses an RFC3339 `created_at` cursor returned by the backend.
   * When the request itself fails (network/down/etc.) and we have no cursor
   * we surface the curated fallback set so the screen stays usable; cursor
   * failures resolve to "no more" so we don't loop on canned data.
   */
  async fetchReels(params: {
    tab: ReelsTab;
    cursor?: string | null;
    limit?: number;
  }): Promise<ReelsPage> {
    try {
      const res = await apiClient.get<ApiReelsResponse>("/api/v1/reels", {
        params: {
          tab: params.tab === "following" ? "following" : "for-you",
          ...(params.cursor ? { cursor: params.cursor } : null),
          limit: params.limit ?? 10,
        },
      });
      const body = res.data;
      if (!body || !Array.isArray(body.data)) {
        throw new Error("malformed");
      }
      return {
        data: body.data.map(adaptReel),
        cursor: body.cursor ?? null,
        has_more: !!body.has_more,
      };
    } catch {
      if (params.cursor) {
        return { data: [], cursor: null, has_more: false };
      }
      return { data: FALLBACK_REELS, cursor: null, has_more: false };
    }
  },

  /** Idempotent like toggle. Returns the post-toggle state for safety. */
  async toggleLike(
    reelId: string,
    _currentlyLiked: boolean,
  ): Promise<{ is_liked: boolean; like_count: number } | void> {
    if (isFallbackId(reelId)) return;
    try {
      const res = await apiClient.post<{ is_liked: boolean; like_count: number }>(
        `/api/v1/posts/${reelId}/like`,
      );
      return res.data;
    } catch {
      throw new Error("like_failed");
    }
  },

  /** Idempotent save (bookmark) toggle. */
  async toggleSave(
    reelId: string,
    _currentlySaved: boolean,
  ): Promise<{ saved: boolean; saves_count: number } | void> {
    if (isFallbackId(reelId)) return;
    try {
      const res = await apiClient.post<{
        data: { saved: boolean; saves_count: number };
      }>(`/api/v1/posts/${reelId}/save`);
      return res.data?.data;
    } catch {
      throw new Error("save_failed");
    }
  },

  /**
   * Follow the author of a reel.
   *
   * The backend `/api/v1/follow` endpoint is one-shot (creates a follower row
   * if missing, no-ops if already present), so we don't try to unfollow here
   * — the UI badge is one-way (+ → ✓). The server expects `follower_email`
   * (or follower_id) + `following_id`.
   */
  async followAuthor(params: {
    followerEmail: string;
    followingUserId: string;
  }): Promise<void> {
    if (!params.followingUserId || !params.followerEmail) return;
    try {
      await apiClient.post(`/api/v1/follow`, {
        follower_email: params.followerEmail,
        following_id: params.followingUserId,
      });
    } catch {
      throw new Error("follow_failed");
    }
  },

  async getComments(
    reelId: string,
    cursor?: string,
  ): Promise<PaginatedResponseDTO<CommentDTO>> {
    if (isFallbackId(reelId)) {
      return { data: [], next_cursor: null, has_more: false, total_count: 0 };
    }
    const offset = cursor ? Number(cursor) : 0;
    const res = await apiClient.get<{
      data: ApiComment[];
      limit: number;
      offset: number;
    }>(`/api/v1/posts/${reelId}/comments`, {
      params: { limit: 30, offset: Number.isFinite(offset) ? offset : 0 },
    });
    const rows = Array.isArray(res.data?.data) ? res.data.data : [];
    const adapted = rows.map(adaptComment);
    const nextOffset =
      (Number.isFinite(offset) ? offset : 0) + adapted.length;
    return {
      data: adapted,
      next_cursor: adapted.length === 30 ? String(nextOffset) : null,
      has_more: adapted.length === 30,
      total_count: null,
    };
  },

  async addComment(reelId: string, content: string): Promise<CommentDTO> {
    if (isFallbackId(reelId)) {
      throw new Error("cannot_comment_on_fallback");
    }
    const res = await apiClient.post<ApiComment>(
      `/api/v1/posts/${reelId}/comments`,
      { content },
    );
    return adaptComment(res.data);
  },

  async reportView(reelId: string, _watchedSeconds: number): Promise<void> {
    // Analytics endpoint isn't wired yet; ignore silently. Kept for callers.
    if (isFallbackId(reelId)) return;
  },
};

// ─── Comment adapter ─────────────────────────────────────────────────────

type ApiComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_username?: string;
  author_display_name?: string;
  author_avatar_url?: string;
};

function adaptComment(c: ApiComment): CommentDTO {
  const username = c.author_username || "user";
  // The local CommentDTO insists on a full UserSummaryDTO, but the comment
  // endpoint only carries the visible fields. Cast through `unknown` so the
  // partial author payload is accepted without weakening UserSummaryDTO.
  const author = {
    id: c.user_id,
    username,
    display_name: c.author_display_name || username,
    avatar_url: c.author_avatar_url || fallbackAvatar(username),
    role: null,
    is_verified: false,
    investor_badge: null,
  } as unknown as CommentDTO["author"];
  return {
    id: c.id,
    author,
    content: c.content,
    like_count: 0,
    is_liked: false,
    parent_comment_id: null,
    reply_count: 0,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}
