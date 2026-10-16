import apiClient from "./axiosInstance";

export const projectsApi = {
  async join(p: { user_email: string; project_id: string }) {
    const res = await apiClient.post<{ ok: boolean; joined: boolean; already?: boolean }>(
      "/api/v1/projects/join",
      p,
    );
    return res.data;
  },

  async listMyProjects(viewer_email: string) {
    const res = await apiClient.get<{ data: { id: string; content: string; created_at: string }[] }>(
      "/api/v1/projects",
      { params: { viewer_email } },
    );
    return res.data.data ?? [];
  },
};

