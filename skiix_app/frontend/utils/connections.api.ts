import apiClient from "./axiosInstance";

export type ConnectionDTO = {
  id: string;
  from_email: string;
  to_email: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
};

export const connectionsApi = {
  /**
   * Create or refresh a request, then re-list so we return the canonical row id from Postgres
   * (the initial POST may return a client id that does not match on ON CONFLICT).
   */
  async requestAndResolvePending(fromEmail: string, toEmail: string): Promise<ConnectionDTO | null> {
    await this.request(fromEmail, toEmail);
    const list = await this.list(fromEmail);
    const f = fromEmail.trim().toLowerCase();
    const t = toEmail.trim().toLowerCase();
    return (
      list.find(
        (c) => c.from_email.toLowerCase() === f && c.to_email.toLowerCase() === t,
      ) ?? null
    );
  },

  async request(fromEmail: string, toEmail: string) {
    const res = await apiClient.post<{ data: ConnectionDTO }>("/api/v1/connections/request", {
      from_email: fromEmail,
      to_email: toEmail,
    });
    return res.data.data;
  },

  async list(email: string) {
    const res = await apiClient.get<{ data: ConnectionDTO[] }>("/api/v1/connections", {
      params: { email },
    });
    return res.data.data ?? [];
  },

  async accept(connectionId: string) {
    await apiClient.post("/api/v1/connections/accept", { id: connectionId });
  },

  async remove(email: string, connectionId: string) {
    await apiClient.post("/api/v1/connections/remove", {
      email,
      id: connectionId,
    });
  },
};

