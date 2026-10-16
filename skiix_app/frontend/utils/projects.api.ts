import apiClient from "./axiosInstance";

export type ProjectRowDTO = {
  id: string;
  content: string;
  created_at: string;
  member_count?: number;
};

export const projectsApi = {
  async join(p: { user_email: string; project_id: string }) {
    const res = await apiClient.post<{ ok: boolean; joined: boolean; already?: boolean }>(
      "/api/v1/projects/join",
      p,
    );
    return res.data;
  },

  async listMyProjects(viewerEmail: string, search?: string) {
    const res = await apiClient.get<{ data: ProjectRowDTO[]; error?: string | null }>(
      "/api/v1/projects",
      {
        params: {
          viewer_email: viewerEmail.toLowerCase(),
          ...(search?.trim() ? { search: search.trim() } : {}),
        },
      },
    );
    return res.data.data ?? [];
  },

  async createProject(viewerEmail: string, title: string) {
    const res = await apiClient.post<{ data: ProjectRowDTO; error?: string | null }>(
      "/api/v1/projects",
      { viewer_email: viewerEmail.toLowerCase(), title: title.trim() },
    );
    return res.data.data;
  },
};
