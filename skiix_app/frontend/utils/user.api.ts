// ============================================================
// USERS API SERVICE
// ============================================================

import apiClient from "./axiosInstance";
import { supabase } from "@/lib/supabase";
import { loadProfileForUser } from "@/services/supabaseAuthService";
import {
  UserDTO,
  UserSummaryDTO,
  UpdateProfileRequestDTO,
} from "@/types/user.types";
import {
  FollowListResponseDTO,
  SearchResultsDTO,
  ConversationDTO,
  MessageDTO,
  SendMessageRequestDTO,
  NotificationListResponseDTO,
  PaginatedResponseDTO,
} from "@/types/index";

export const usersApi = {
  /**
   * Get authenticated user's profile
   * GET /users/me
   */
  async getMe(): Promise<UserDTO> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) throw new Error("Not signed in");
    const { user: dto } = await loadProfileForUser(data.user);
    return dto;
  },

  /**
   * Get a user's public profile
   * GET /users/:username
   */
  async getProfile(username: string): Promise<UserDTO> {
    const res = await apiClient.get<UserDTO>(`/users/${username}`);
    return res.data;
  },

  /**
   * Update current user's profile
   * PATCH /users/me
   */
  async updateProfile(data: UpdateProfileRequestDTO): Promise<UserDTO> {
    const res = await apiClient.patch<UserDTO>("/users/me", data);
    return res.data;
  },

  /**
   * Upload profile avatar
   * POST /users/me/avatar (multipart/form-data)
   */
  async uploadAvatar(formData: FormData): Promise<{ avatar_url: string }> {
    const res = await apiClient.post<{ avatar_url: string }>(
      "/users/me/avatar",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return res.data;
  },

  /**
   * Follow a user
   * POST /users/:id/follow
   */
  async follow(userId: string): Promise<void> {
    await apiClient.post(`/users/${userId}/follow`);
  },

  /**
   * Unfollow a user
   * DELETE /users/:id/follow
   */
  async unfollow(userId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}/follow`);
  },

  /**
   * Get followers list
   * GET /users/:id/followers
   */
  async getFollowers(
    userId: string,
    cursor?: string,
  ): Promise<FollowListResponseDTO> {
    const res = await apiClient.get<FollowListResponseDTO>(
      `/users/${userId}/followers`,
      {
        params: { cursor, limit: 30 },
      },
    );
    return res.data;
  },

  /**
   * Get following list
   * GET /users/:id/following
   */
  async getFollowing(
    userId: string,
    cursor?: string,
  ): Promise<FollowListResponseDTO> {
    const res = await apiClient.get<FollowListResponseDTO>(
      `/users/${userId}/following`,
      {
        params: { cursor, limit: 30 },
      },
    );
    return res.data;
  },

  /**
   * Get suggested users to follow
   * GET /users/suggestions
   */
  async getSuggestions(limit = 10): Promise<UserSummaryDTO[]> {
    const res = await apiClient.get<UserSummaryDTO[]>("/users/suggestions", {
      params: { limit },
    });
    return res.data;
  },

  /**
   * Block a user
   * POST /users/:id/block
   */
  async blockUser(userId: string): Promise<void> {
    await apiClient.post(`/users/${userId}/block`);
  },
};

// ============================================================
// MESSAGING API SERVICE
// ============================================================

export const messagingApi = {
  /**
   * Get all conversations
   * GET /conversations
   */
  async getConversations(): Promise<ConversationDTO[]> {
    const res = await apiClient.get<{ data: ConversationDTO[] }>("/api/v1/conversations");
    return res.data?.data ?? [];
  },

  /**
   * Get or create a DM conversation with a user
   * POST /api/v1/conversations
   */
  async getOrCreateDirect(recipientId: string): Promise<ConversationDTO> {
    const res = await apiClient.post<{ data: ConversationDTO }>("/api/v1/conversations", {
      recipient_id: recipientId,
    });
    const row = res.data?.data ?? (res.data as unknown as ConversationDTO);
    return {
      id: row.id,
      participants: row.participants ?? [],
      is_group: row.is_group ?? false,
      group_name: row.group_name ?? null,
      group_avatar_url: row.group_avatar_url ?? null,
      last_message: row.last_message ?? null,
      unread_count: row.unread_count ?? 0,
      is_muted: row.is_muted ?? false,
      created_at: row.created_at ?? new Date().toISOString(),
      updated_at: row.updated_at ?? new Date().toISOString(),
    };
  },

  /**
   * Get messages in a conversation
   * GET /conversations/:id/messages
   */
  async getMessages(
    conversationId: string,
    cursor?: string,
  ): Promise<PaginatedResponseDTO<MessageDTO>> {
    const res = await apiClient.get<PaginatedResponseDTO<MessageDTO>>(
      `/conversations/${conversationId}/messages`,
      { params: { cursor, limit: 30 } },
    );
    return res.data;
  },

  /**
   * Send a message
   * POST /conversations/:id/messages
   */
  async sendMessage(
    conversationId: string,
    data: SendMessageRequestDTO,
  ): Promise<MessageDTO> {
    const res = await apiClient.post<MessageDTO>(
      `/conversations/${conversationId}/messages`,
      data,
    );
    return res.data;
  },

  /**
   * Mark conversation as read
   * POST /conversations/:id/read
   */
  async markRead(conversationId: string): Promise<void> {
    await apiClient.post(`/conversations/${conversationId}/read`);
  },

  /**
   * Delete a message
   * DELETE /conversations/:conversationId/messages/:messageId
   */
  async deleteMessage(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/conversations/${conversationId}/messages/${messageId}`,
    );
  },
};

// ============================================================
// NOTIFICATIONS API SERVICE
// ============================================================

export const notificationsApi = {
  /**
   * Get notifications list
   * GET /notifications
   */
  async getNotifications(
    cursor?: string,
  ): Promise<NotificationListResponseDTO> {
    const res = await apiClient.get<NotificationListResponseDTO>(
      "/notifications",
      {
        params: { cursor, limit: 30 },
      },
    );
    return res.data;
  },

  /**
   * Mark all notifications as read
   * POST /notifications/read-all
   */
  async markAllRead(): Promise<void> {
    await apiClient.post("/notifications/read-all");
  },

  /**
   * Mark a specific notification as read
   * POST /notifications/:id/read
   */
  async markRead(notificationId: string): Promise<void> {
    await apiClient.post(`/notifications/${notificationId}/read`);
  },

  /**
   * Get unread notification count
   * GET /notifications/unread-count
   */
  async getUnreadCount(): Promise<{ count: number }> {
    const res = await apiClient.get<{ count: number }>(
      "/notifications/unread-count",
    );
    return res.data;
  },
};

// ============================================================
// SEARCH API SERVICE
// ============================================================

export const searchApi = {
  /**
   * Search users + hashtags
   * GET /search?q=xxx&type=all|users|hashtags
   */
  async search(
    query: string,
    type: "all" | "users" | "hashtags" = "all",
  ): Promise<SearchResultsDTO> {
    const res = await apiClient.get<SearchResultsDTO>("/search", {
      params: { q: query, type },
    });
    return res.data;
  },

  /**
   * Get trending hashtags
   * GET /search/trending/hashtags
   */
  async getTrendingHashtags(): Promise<{ tag: string; post_count: number }[]> {
    const res = await apiClient.get<{ tag: string; post_count: number }[]>(
      "/search/trending/hashtags",
    );
    return res.data;
  },

  /**
   * Get trending posts
   * GET /search/trending/posts
   */
  async getTrendingPosts(cursor?: string) {
    const res = await apiClient.get("/search/trending/posts", {
      params: { cursor, limit: 20 },
    });
    return res.data;
  },
};
