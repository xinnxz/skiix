import apiClient from "./axiosInstance";
import type { HomeFeedPost } from "@/types/homeFeed.types";

export type ShufflePost = {
  id: string;
  type: string;
  content: string;
  media_url?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  media_type?: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  author_email: string;
  author_username: string;
  is_project?: boolean;
  project_id?: string | null;
  tags?: string[];
  explore_title?: string | null;
};

export type SparkCard = {
  post_id: string;
  category: "learn" | "startup" | "wildcard";
  thumbnail: string;
  title: string;
  creator: string;
  media_type?: string;
  content_preview?: string;
};

export type SparkChoices = {
  learn: SparkCard | null;
  startup: SparkCard | null;
  wildcard: SparkCard | null;
};

export type VibeStats = {
  post_id: string;
  vibe_score: number;
  vibe_love_pct: number;
  vibe_neutral_pct: number;
  vibe_disagree_pct: number;
  avg_vibe_score: number;
  vibe_count: number;
};

export type WorkspaceCategory =
  | "startup_ideas"
  | "research"
  | "projects"
  | "learning";

export function shufflePostToFeedItem(raw: ShufflePost): HomeFeedPost {
  return {
    id: raw.id,
    user_id: "",
    content: raw.content,
    media_url: raw.media_url,
    image_url: raw.image_url,
    thumbnail_url: raw.thumbnail_url,
    media_type: raw.media_type,
    type: (raw.type as HomeFeedPost["type"]) ?? "text",
    is_project: raw.is_project,
    project_id: raw.project_id,
    like_count: raw.like_count,
    comment_count: raw.comment_count,
    created_at: raw.created_at,
    updated_at: raw.created_at,
    author_email: raw.author_email,
    author_username: raw.author_username,
    is_liked: false,
    is_saved: false,
    tags: raw.tags,
  };
}

export const mvpFeaturesApi = {
  async fetchShuffle(viewerEmail?: string): Promise<ShufflePost | null> {
    const res = await apiClient.get<{ data: ShufflePost | null }>("/api/v1/feed/shuffle", {
      params: { viewer_email: viewerEmail || undefined },
    });
    return res.data.data ?? null;
  },

  async fetchSpark(viewerEmail?: string): Promise<SparkChoices> {
    const res = await apiClient.get<{ data: SparkChoices }>("/api/v1/feed/spark", {
      params: { viewer_email: viewerEmail || undefined },
    });
    return res.data.data;
  },

  async selectSpark(category: SparkCard["category"], postId: string): Promise<void> {
    await apiClient.post("/api/v1/feed/spark/select", { category, post_id: postId });
  },

  async setVibe(postId: string, vibeScore: number): Promise<VibeStats> {
    const res = await apiClient.post<{ data: VibeStats }>("/api/v1/posts/vibe", {
      post_id: postId,
      vibe_score: vibeScore,
    });
    return res.data.data;
  },

  async toggleSave(postId: string): Promise<{ saved: boolean; saves_count: number }> {
    const res = await apiClient.post<{ data: { saved: boolean; saves_count: number } }>(
      `/api/v1/posts/${encodeURIComponent(postId)}/save`,
    );
    return res.data.data;
  },

  async createReminder(postId: string, remindAt: Date): Promise<void> {
    await apiClient.post("/api/v1/bookmarks/reminder", {
      post_id: postId,
      remind_at: remindAt.toISOString(),
    });
  },

  async createNote(
    postId: string,
    payload: { title: string; content: string; creator_name: string },
  ): Promise<void> {
    await apiClient.post("/api/v1/bookmarks/note", {
      post_id: postId,
      ...payload,
    });
  },

  async saveToWorkspace(postId: string, category: WorkspaceCategory): Promise<void> {
    await apiClient.post("/api/v1/bookmarks/workspace", { post_id: postId, category });
  },

  async fetchCalendarIcs(postId: string): Promise<string> {
    const res = await apiClient.get<string>(`/api/v1/bookmarks/calendar/${encodeURIComponent(postId)}`, {
      responseType: "text",
    });
    return typeof res.data === "string" ? res.data : String(res.data);
  },
};
