import apiClient from "./axiosInstance";

export type PublicPostDTO = {
  id: string;
  user_id: string;
  type?: "reel" | "text" | "story" | "project";
  content: string;
  media_url?: string | null;
  image_url?: string | null; // legacy
  is_project?: boolean;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
};

export const publicPostsApi = {
  async create(p: {
    author_email: string;
    type: "reel" | "text" | "story" | "project";
    content: string;
    media_url?: string | null;
    project_id?: string | null;
  }) {
    const res = await apiClient.post<{ data: PublicPostDTO }>("/api/v1/public/posts", {
      author_email: p.author_email,
      type: p.type,
      content: p.content,
      media_url: p.media_url ?? null,
      // legacy alias for older backend fields
      image_url: p.media_url ?? null,
      is_project: p.type === "project",
      project_id: p.project_id ?? null,
    });
    return res.data.data;
  },
};

