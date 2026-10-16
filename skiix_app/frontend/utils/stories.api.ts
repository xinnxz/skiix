import apiClient from "./axiosInstance";

export type StorySlideDTO = {
  id: string;
  media_url: string;
  media_type: string;
  expires_at: string;
  created_at?: string;
  caption?: string | null;
};

export type StoryRingBucketDTO = {
  user_id: string;
  username: string;
  avatar_url: string;
  has_unseen: boolean;
  stories: StorySlideDTO[];
};

export const storiesApi = {
  /** Grouped carousel rows for the stories ring (`?email=` matches existing backend contract). */
  async feedRing(viewerEmail: string) {
    const res = await apiClient.get<{ data: StoryRingBucketDTO[]; error?: string | null }>(
      "/api/v1/stories/feed",
      {
        params: { email: viewerEmail.toLowerCase() },
      },
    );
    return res.data.data ?? [];
  },

  async create(p: {
    author_email: string;
    media_url: string;
    media_type: "image" | "video";
    caption?: string;
    expires_at?: string;
    location?: string;
    hashtags?: string;
    audience?: "everyone" | "followers" | "close_friends";
    allow_replies?: "everyone" | "followers" | "none";
  }) {
    const res = await apiClient.post<{
      data: {
        id: string;
        author_email: string;
        media_url: string;
        media_type: string;
        caption?: string | null;
        created_at: string;
        expires_at: string;
      };
      error?: string | null;
    }>("/api/v1/stories", p);
    return res.data.data;
  },

  async markSeen(viewerEmail: string, storyId: string) {
    const res = await apiClient.post<{ data: { ok: boolean }; error?: string | null }>(
      `/api/v1/stories/${storyId}/seen`,
      { viewer_email: viewerEmail.toLowerCase() },
    );
    return res.data.data?.ok ?? false;
  },
};
