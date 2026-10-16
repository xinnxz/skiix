// ============================================================
// REEL DTOs
// ============================================================

import { UserSummaryDTO } from "./user.types";
import { HashtagDTO } from "./post.types";

/** Reel entity (short-form video content) */
export interface ReelDTO {
  id: string;
  /** Author user summary */
  author: UserSummaryDTO;
  /** Video URL (HLS or MP4) */
  video_url: string;
  /** Thumbnail / poster URL */
  thumbnail_url: string;
  /** Caption text */
  caption: string | null;
  /** Hashtags parsed from caption */
  hashtags: HashtagDTO[];
  /** Audio track name if using a sound */
  audio_name: string | null;
  /** Original audio author */
  audio_author: string | null;
  /** Video duration in seconds */
  duration_seconds: number;
  /** Video width px */
  width: number;
  /** Video height px */
  height: number;
  /** Like count */
  like_count: number;
  /** Comment count */
  comment_count: number;
  /** Share count */
  share_count: number;
  /** View count */
  view_count: number;
  /** Whether requesting user liked this reel */
  is_liked: boolean;
  /** Whether requesting user bookmarked this reel */
  is_bookmarked: boolean;
  /** Whether requesting user is following the author */
  is_following_author: boolean;
  /** Tags for discoverability: pitch, product_demo, founder_story, etc. */
  content_type:
    | "pitch"
    | "product_demo"
    | "founder_story"
    | "funding_news"
    | "general";
  /** ISO 8601 timestamp */
  created_at: string;
}

/** Reel feed response */
export interface ReelFeedResponseDTO {
  reels: ReelDTO[];
  next_cursor: string | null;
  has_more: boolean;
}

/** Create reel request */
export interface CreateReelRequestDTO {
  /** Uploaded video asset ID */
  video_asset_id: string;
  /** Caption (max 300 chars) */
  caption?: string;
  /** Content type category */
  content_type: ReelDTO["content_type"];
  /** Audio track ID if using library audio */
  audio_id?: string;
}

// ============================================================
// COMMENT DTOs
// ============================================================

/** Comment on a post or reel */
export interface CommentDTO {
  id: string;
  author: UserSummaryDTO;
  content: string;
  like_count: number;
  is_liked: boolean;
  /** Parent comment ID if reply */
  parent_comment_id: string | null;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

/** Create comment request */
export interface CreateCommentRequestDTO {
  content: string;
  parent_comment_id?: string;
}

// ============================================================
// MESSAGE DTOs
// ============================================================

/** Conversation entity */
export interface ConversationDTO {
  id: string;
  /** Participants (excludes requesting user) */
  participants: UserSummaryDTO[];
  /** Is this a group conversation */
  is_group: boolean;
  /** Group name (for group DMs) */
  group_name: string | null;
  /** Group avatar URL */
  group_avatar_url: string | null;
  /** Last message preview */
  last_message: MessageDTO | null;
  /** Count of unread messages */
  unread_count: number;
  /** Whether requesting user muted this conversation */
  is_muted: boolean;
  created_at: string;
  updated_at: string;
}

/** Message entity */
export interface MessageDTO {
  id: string;
  conversation_id: string;
  sender: UserSummaryDTO;
  /** Text content of the message */
  content: string | null;
  /** Attached media URL */
  media_url: string | null;
  /** Media type */
  media_type: "image" | "video" | "file" | null;
  /** Shared post (post card in DM) */
  shared_post_id: string | null;
  /** Shared reel ID */
  shared_reel_id: string | null;
  /** Whether message was read by all participants */
  is_read: boolean;
  /** Message read receipts */
  read_by: MessageReadReceiptDTO[];
  /** Replied-to message ID */
  reply_to_id: string | null;
  /** Whether this message was deleted */
  is_deleted: boolean;
  created_at: string;
}

/** Read receipt */
export interface MessageReadReceiptDTO {
  user_id: string;
  read_at: string;
}

/** Send message request */
export interface SendMessageRequestDTO {
  content?: string;
  media_url?: string;
  media_type?: "image" | "video" | "file";
  shared_post_id?: string;
  shared_reel_id?: string;
  reply_to_id?: string;
}

// ============================================================
// NOTIFICATION DTOs
// ============================================================

/** Notification types */
export type NotificationType =
  | "like_post"
  | "like_reel"
  | "comment"
  | "reply"
  | "follow"
  | "follow_request"
  | "mention"
  | "repost"
  | "message"
  | "investment_interest"
  | "startup_update";

/** Notification entity */
export interface NotificationDTO {
  id: string;
  type: NotificationType;
  /** User who triggered the notification */
  actor: UserSummaryDTO;
  /** Human-readable notification text */
  message: string;
  /** Whether the notification has been read */
  is_read: boolean;
  /** Related entity IDs */
  post_id: string | null;
  reel_id: string | null;
  comment_id: string | null;
  /** ISO 8601 timestamp */
  created_at: string;
}

/** Notification list response */
export interface NotificationListResponseDTO {
  notifications: NotificationDTO[];
  unread_count: number;
  next_cursor: string | null;
  has_more: boolean;
}

// ============================================================
// FOLLOW DTOs
// ============================================================

/** Follow relationship entity */
export interface FollowDTO {
  follower_id: string;
  following_id: string;
  created_at: string;
}

/** Followers / following list response */
export interface FollowListResponseDTO {
  users: UserSummaryDTO[];
  next_cursor: string | null;
  has_more: boolean;
}

// ============================================================
// SEARCH DTOs
// ============================================================

/** Search results */
export interface SearchResultsDTO {
  users: UserSummaryDTO[];
  hashtags: HashtagDTO[];
  /** Total user result count */
  user_total: number;
  /** Total hashtag result count */
  hashtag_total: number;
}

// ============================================================
// PAGINATION / COMMON DTOs
// ============================================================

/** Generic API error response */
export interface ApiErrorDTO {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/** Generic paginated list */
export interface PaginatedResponseDTO<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
  total_count: number | null;
}
