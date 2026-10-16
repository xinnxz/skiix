import apiClient from "./axiosInstance";

export const followApi = {
  async follow(p: { follower_email: string; following_email: string }) {
    const res = await apiClient.post<{ ok: boolean; following: boolean; already?: boolean }>(
      "/api/v1/follow",
      p,
    );
    return res.data;
  },
};

