import apiClient from "./axiosInstance";

/** Mirrors `domain.CreatePostRequest` JSON for authenticated POST /api/v1/posts. */
export type AuthenticatedCreatePostPayload = {
  type: string;
  content?: string;
  image_url?: string | null;
  media_url?: string | null;
  is_project?: boolean;
  project_id?: string | null;
  visibility?: string;
  circle_id?: string | null;
  categories?: string[];
  thumbnail_url?: string | null;
  cloudinary_public_id?: string | null;
  video_duration?: number | null;
  aspect_width?: number | null;
  aspect_height?: number | null;
  category?: string | null;
  explore_title?: string | null;
  tags?: string[];
  location?: string | null;
  audience?: string | null;
  share_to_feed?: boolean | null;
  share_to_profile?: boolean | null;
  extra_media_urls?: string[] | null;
  is_new_project?: boolean;
  metrics?: string | null;
  milestone_type?: string | null;
  project_name?: string | null;
};

export type CreatedPostResponse = {
  id: string;
  user_id: string;
  type: string;
  content: string;
  media_url?: string | null;
  image_url?: string | null;
  is_project?: boolean;
  project_id?: string | null;
  is_new_project?: boolean;
  metrics?: string | null;
  milestone_type?: string | null;
  project_name?: string | null;
  thumbnail_url?: string | null;
  tags?: string[];
  extra_media_urls?: string[] | null;
  created_at: string;
  updated_at: string;
};

export async function createAuthenticatedPost(payload: AuthenticatedCreatePostPayload) {
  if (__DEV__) {
    console.log("[PostCreate] POST /api/v1/posts", { type: payload.type });
  }
  const { data } = await apiClient.post<CreatedPostResponse>("/api/v1/posts", payload);
  if (__DEV__) {
    console.log("[PostCreate] created", { id: data.id, type: data.type });
  }
  return data;
}
