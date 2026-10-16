import apiClient from "./axiosInstance";

export type PublicPostDTO = {
  id: string;
  user_id: string;
  type?: "reel" | "text" | "story" | "project" | "project_update";
  content: string;
  media_url?: string | null;
  image_url?: string | null; // legacy
  is_project?: boolean;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicPostCreateType = NonNullable<PublicPostDTO["type"]>;

export const publicPostsApi = {
  async create(p: {
    author_email: string;
    type: PublicPostCreateType;
    content: string;
    media_url?: string | null;
    project_id?: string | null;
    tags?: string[];
    location?: string | null;
    // Optional reel/explore metadata. Stored directly on `posts` by the
    // backend when present; ignored when missing.
    thumbnail_url?: string | null;
    cloudinary_public_id?: string | null;
    video_duration?: number;
    aspect_width?: number;
    aspect_height?: number;
    category?: string | null;
    explore_title?: string | null;
    extra_media_urls?: string[];
    is_new_project?: boolean;
    metrics?: string | null;
    milestone_type?: string | null;
    project_name?: string | null;
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
      tags: p.tags ?? [],
      location: p.location ?? null,
      thumbnail_url: p.thumbnail_url ?? null,
      cloudinary_public_id: p.cloudinary_public_id ?? null,
      video_duration: p.video_duration,
      aspect_width: p.aspect_width,
      aspect_height: p.aspect_height,
      category: p.category ?? null,
      explore_title: p.explore_title ?? null,
      extra_media_urls: p.extra_media_urls ?? [],
      is_new_project: p.is_new_project ?? false,
      metrics: p.metrics ?? "",
      milestone_type: p.milestone_type ?? "",
      project_name: p.project_name ?? "",
    });
    return res.data.data;
  },
};
