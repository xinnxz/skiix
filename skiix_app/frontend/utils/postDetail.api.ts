import apiClient from "./axiosInstance";

export type PostDetailDTO = {
  id: string;
  type: string;
  content: string;
  media_url: string;
  media_type: string;
  thumbnail_url?: string;
  tags: string[];
  location: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_saved: boolean;
  is_following: boolean;
  is_own_post: boolean;
  project_id?: string | null;
  project_name?: string;
  is_new_project?: boolean;
  metrics?: string;
  is_joined?: boolean;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  role_tag: string;
  is_verified: boolean;
  extra_media_urls?: string[];
  viewer_vibe_score?: number;
  vibe_love_pct?: number;
  vibe_neutral_pct?: number;
  vibe_disagree_pct?: number;
  avg_vibe_score?: number;
  vibe_count?: number;
  saves_count?: number;
};

export type ProjectDetailDTO = {
  id: string;
  title: string;
  description: string;
  logo_url: string;
  banner_url: string;
  category: string;
  owner_id: string;
  created_at: string;
  member_count: number;
  posts_count: number;
  is_joined: boolean;
  is_owner: boolean;
  owner_username: string;
  owner_full_name: string;
  owner_avatar_url: string;
};

export type ProjectMemberDTO = {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  role_tag: string;
  project_role: string;
  joined_at: string;
};

export const postDetailApi = {
  async getPost(postId: string) {
    const res = await apiClient.get<{ data: PostDetailDTO }>(
      `/api/v1/posts/${encodeURIComponent(postId)}/detail`,
    );
    return res.data.data;
  },

  async getProject(projectId: string) {
    const res = await apiClient.get<{ data: ProjectDetailDTO }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/detail`,
    );
    return res.data.data;
  },

  async getProjectMembers(projectId: string) {
    const res = await apiClient.get<{ data: ProjectMemberDTO[] }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/members`,
    );
    return res.data.data ?? [];
  },

  async toggleLike(postId: string) {
    await apiClient.post(`/api/v1/posts/${encodeURIComponent(postId)}/like`);
  },
};
