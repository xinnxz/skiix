// ============================================================
// POST DTOs
// ============================================================

import { UserSummaryDTO } from "./user.types";

/** Media type within a post */
export type MediaType = "image" | "video" | "link_preview";

/** Media attachment on a post */
export interface PostMediaDTO {
  id: string;
  /** Media type */
  type: MediaType;
  /** CDN URL for the media */
  url: string;
  /** Thumbnail URL (for video) */
  thumbnail_url: string | null;
  /** Width in pixels */
  width: number | null;
  /** Height in pixels */
  height: number | null;
  /** Alt text for accessibility */
  alt_text: string | null;
  /** Duration in seconds (for video) */
  duration_seconds: number | null;
  /** Display order (0-indexed) */
  order: number;
}

/** Single hashtag entity */
export interface HashtagDTO {
  /** Tag text without '#' */
  tag: string;
  /** Total posts with this tag */
  post_count: number;
}

/** Post / Thread entity */
export interface PostDTO {
  id: string;
  /** Author user summary */
  author: UserSummaryDTO;
  /** Text content of the post */
  content: string;
  /** Parsed hashtags in content */
  hashtags: HashtagDTO[];
  /** Mentioned user IDs */
  mentioned_user_ids: string[];
  /** Media attachments */
  media: PostMediaDTO[];
  /** Parent post ID if this is a reply */
  parent_post_id: string | null;
  /** Root post ID if this is in a thread */
  root_post_id: string | null;
  /** Quoted post (repost with comment) */
  quoted_post: PostDTO | null;
  /** Like count */
  like_count: number;
  /** Reply count */
  reply_count: number;
  /** Repost / quote count */
  repost_count: number;
  /** Bookmark count */
  bookmark_count: number;
  /** View count */
  view_count: number;
  /** Whether requesting user liked this post */
  is_liked: boolean;
  /** Whether requesting user bookmarked this post */
  is_bookmarked: boolean;
  /** Whether requesting user reposted this post */
  is_reposted: boolean;
  /** Whether this is pinned to author's profile */
  is_pinned: boolean;
  /** Post visibility: public, followers_only, connections_only */
  visibility: "public" | "followers_only" | "connections_only";
  /** ISO 8601 timestamp */
  created_at: string;
  updated_at: string;
}

/** Paginated post list response */
export interface PostFeedResponseDTO {
  posts: PostDTO[];
  next_cursor: string | null;
  has_more: boolean;
}

// ============================================================
// REQUEST DTOs
// ============================================================

/** Create post request */
export interface CreatePostRequestDTO {
  /** Post text content (max 500 chars) */
  content: string;
  /** Optional parent post ID to reply to */
  parent_post_id?: string;
  /** Optional post to quote */
  quoted_post_id?: string;
  /** Uploaded media IDs (from media upload endpoint) */
  media_ids?: string[];
  /** Visibility setting */
  visibility?: "public" | "followers_only" | "connections_only";
}

/** Feed query params */
export interface FeedQueryParams {
  /** Pagination cursor */
  cursor?: string;
  /** Number of items per page (default: 20, max: 50) */
  limit?: number;
  /** Feed type */
  feed_type?: "for_you" | "following" | "trending";
}
