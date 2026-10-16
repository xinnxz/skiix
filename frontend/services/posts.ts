import axiosInstance from "@/utils/axiosInstance";
import { getApiErrorMessage } from "@/utils/getApiErrorMessage";

/**
 * Types
 */

export interface Post {
  id: string;
  content: string;
  image_url?: string;
  author_email: string;
  user_id: string;
  circle_id?: string;
  visibility: "public" | "private";

  like_count: number;
  comment_count: number;
  is_liked: boolean;

  created_at: string;
  updated_at: string;
}

export interface GetPostsParams {
  limit?: number; // max 50
  offset?: number;
}

export interface LikeResponse {
  liked: boolean;
  like_count: number;
}

/**
 * Post Service
 */

export const postService = {
  /**
   * GET /api/v1/posts
   */
  async getPosts(params?: GetPostsParams): Promise<Post[]> {
    try {
      const response = await axiosInstance.get<Post[]>("/api/v1/posts", {
        params: {
          limit: params?.limit ?? 20,
          offset: params?.offset ?? 0,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  },

  /**
   * POST /api/v1/posts/{post_id}/like
   * Toggle like
   */
  async toggleLike(postId: string): Promise<LikeResponse> {
    try {
      const response = await axiosInstance.post<LikeResponse>(
        `/api/v1/posts/${postId}/like`,
      );

      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  },
};
