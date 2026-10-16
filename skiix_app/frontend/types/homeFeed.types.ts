/** Shape of each item from `GET /api/v1/feed` (enriched for home interactions). */
export type HomeFeedPost = {
  id: string;
  user_id: string;
  content: string;
  media_url?: string | null;
  image_url?: string | null;
  is_project?: boolean;
  type?: "project" | "text" | "reel" | "story" | "project_update";
  project_id?: string | null;
  /** First project announcement — feed shows Join Project */
  is_new_project?: boolean;
  metrics?: string | null;
  milestone_type?: string | null;
  project_name?: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author_email: string;
  author_username?: string;
  is_verified?: boolean;
  is_own_post?: boolean;
  is_liked: boolean;
  is_saved?: boolean;
  saves_count?: number;
  viewer_vibe_score?: number;
  vibe_love_pct?: number;
  vibe_neutral_pct?: number;
  vibe_disagree_pct?: number;
  avg_vibe_score?: number;
  vibe_count?: number;
  is_joined?: boolean;
  is_following?: boolean;
  /** Attachment classifier from API: image | video */
  media_type?: string;
  thumbnail_url?: string | null;
  tags?: string[];
  /** Additional images for multi-photo text posts */
  extra_media_urls?: string[] | null;
};
