import apiClient from "./axiosInstance";

export type StoryDTO = {
  id: string;
  author_email: string;
  media_url: string;
  media_type: "image" | "video";
  caption?: string | null;
  created_at: string;
  expires_at: string;
};

export const storiesApi = {
  async feed(email: string) {
    const res = await apiClient.get<{ data: StoryDTO[] }>("/api/v1/stories/feed", {
      params: { email },
    });
    return res.data.data ?? [];
  },

  async create(p: {
    author_email: string;
    media_url: string;
    media_type: "image" | "video";
    caption?: string;
  }) {
    const res = await apiClient.post<StoryDTO>("/api/v1/stories", p);
    return res.data;
  },
};

