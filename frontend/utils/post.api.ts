// ============================================================
// POSTS API SERVICE
// ============================================================

import apiClient from "./axiosInstance";
import {
  PostDTO,
  PostFeedResponseDTO,
  CreatePostRequestDTO,
  FeedQueryParams,
} from "@/types/post.types";
import {
  CommentDTO,
  CreateCommentRequestDTO,
  PaginatedResponseDTO,
} from "@/types/index";

export const postsApi = {
  /**
   * Fetch paginated post feed
   * GET /feed/posts
   */
  async getFeed(params?: FeedQueryParams): Promise<PostFeedResponseDTO> {
    const res = await apiClient.get<PostFeedResponseDTO>("/feed/posts", {
      params,
    });
    return res.data;
  },

  /**
   * Get a single post by ID
   * GET /posts/:id
   */
  async getPost(id: string): Promise<PostDTO> {
    const res = await apiClient.get<PostDTO>(`/posts/${id}`);
    return res.data;
  },

  /**
   * Create a new post
   * POST /posts
   */
  async createPost(data: CreatePostRequestDTO): Promise<PostDTO> {
    const res = await apiClient.post<PostDTO>("/posts", data);
    return res.data;
  },

  /**
   * Delete a post
   * DELETE /posts/:id
   */
  async deletePost(id: string): Promise<void> {
    await apiClient.delete(`/posts/${id}`);
  },

  /**
   * Like / unlike a post
   * POST /posts/:id/like  |  DELETE /posts/:id/like
   */
  async toggleLike(
    id: string,
    liked: boolean,
  ): Promise<{ like_count: number }> {
    const res = liked
      ? await apiClient.delete<{ like_count: number }>(`/posts/${id}/like`)
      : await apiClient.post<{ like_count: number }>(`/posts/${id}/like`);
    return res.data;
  },

  /**
   * Bookmark / unbookmark a post
   */
  async toggleBookmark(id: string, bookmarked: boolean): Promise<void> {
    if (bookmarked) {
      await apiClient.delete(`/posts/${id}/bookmark`);
    } else {
      await apiClient.post(`/posts/${id}/bookmark`);
    }
  },

  /**
   * Repost a post
   * POST /posts/:id/repost
   */
  async repost(id: string): Promise<void> {
    await apiClient.post(`/posts/${id}/repost`);
  },

  /**
   * Get comments for a post
   * GET /posts/:id/comments
   */
  async getComments(
    postId: string,
    cursor?: string,
  ): Promise<PaginatedResponseDTO<CommentDTO>> {
    const res = await apiClient.get<PaginatedResponseDTO<CommentDTO>>(
      `/posts/${postId}/comments`,
      { params: { cursor, limit: 20 } },
    );
    return res.data;
  },

  /**
   * Add a comment
   * POST /posts/:id/comments
   */
  async addComment(
    postId: string,
    data: CreateCommentRequestDTO,
  ): Promise<CommentDTO> {
    const res = await apiClient.post<CommentDTO>(
      `/posts/${postId}/comments`,
      data,
    );
    return res.data;
  },

  /**
   * Get posts by user
   * GET /users/:userId/posts
   */
  async getUserPosts(
    userId: string,
    cursor?: string,
  ): Promise<PostFeedResponseDTO> {
    const res = await apiClient.get<PostFeedResponseDTO>(
      `/users/${userId}/posts`,
      {
        params: { cursor, limit: 20 },
      },
    );
    return res.data;
  },

  /**
   * Get trending hashtag posts
   * GET /feed/hashtag/:tag
   */
  async getHashtagFeed(
    tag: string,
    cursor?: string,
  ): Promise<PostFeedResponseDTO> {
    const res = await apiClient.get<PostFeedResponseDTO>(
      `/feed/hashtag/${tag}`,
      {
        params: { cursor, limit: 20 },
      },
    );
    return res.data;
  },
};

// ============================================================
// REELS API SERVICE
// ============================================================

import {
  ReelDTO,
  ReelFeedResponseDTO,
  CreateReelRequestDTO,
} from "@/types/index";

export const reelsApi = {
  /**
   * Get reel feed (paginated, cursor-based)
   * GET /feed/reels
   */
  async getReelFeed(cursor?: string): Promise<ReelFeedResponseDTO> {
    const res = await apiClient.get<ReelFeedResponseDTO>("/feed/reels", {
      params: { cursor, limit: 10 },
    });
    return res.data;
  },

  /**
   * Get a single reel
   * GET /reels/:id
   */
  async getReel(id: string): Promise<ReelDTO> {
    const res = await apiClient.get<ReelDTO>(`/reels/${id}`);
    return res.data;
  },

  /**
   * Create a new reel
   * POST /reels
   */
  async createReel(data: CreateReelRequestDTO): Promise<ReelDTO> {
    const res = await apiClient.post<ReelDTO>("/reels", data);
    return res.data;
  },

  /**
   * Like / unlike a reel
   */
  async toggleLike(
    id: string,
    liked: boolean,
  ): Promise<{ like_count: number }> {
    const res = liked
      ? await apiClient.delete<{ like_count: number }>(`/reels/${id}/like`)
      : await apiClient.post<{ like_count: number }>(`/reels/${id}/like`);
    return res.data;
  },

  /**
   * Bookmark a reel
   */
  async toggleBookmark(id: string, bookmarked: boolean): Promise<void> {
    if (bookmarked) {
      await apiClient.delete(`/reels/${id}/bookmark`);
    } else {
      await apiClient.post(`/reels/${id}/bookmark`);
    }
  },

  /**
   * Get comments for a reel
   */
  async getComments(
    reelId: string,
    cursor?: string,
  ): Promise<PaginatedResponseDTO<CommentDTO>> {
    const res = await apiClient.get<PaginatedResponseDTO<CommentDTO>>(
      `/reels/${reelId}/comments`,
      { params: { cursor, limit: 20 } },
    );
    return res.data;
  },

  /**
   * Add comment to reel
   */
  async addComment(
    reelId: string,
    data: CreateCommentRequestDTO,
  ): Promise<CommentDTO> {
    const res = await apiClient.post<CommentDTO>(
      `/reels/${reelId}/comments`,
      data,
    );
    return res.data;
  },

  /**
   * Report view (for analytics)
   * POST /reels/:id/view
   */
  async reportView(id: string, watchedSeconds: number): Promise<void> {
    await apiClient.post(`/reels/${id}/view`, {
      watched_seconds: watchedSeconds,
    });
  },
};
