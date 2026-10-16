import apiClient from "./axiosInstance";

/** Comment row returned by Go `GET /api/v1/posts/:id/comments`. */
export type ApiPostComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_username?: string;
  author_display_name?: string;
  author_avatar_url?: string;
  /** Aliases populated by Go (`username` / `avatar_url`). */
  username?: string;
  avatar_url?: string;
};

function pickStr(...vals: unknown[]) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function tsToIso(v: unknown): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v).toISOString();
  return new Date().toISOString();
}

/** Normalizes Go/JSON quirks and field aliases into ApiPostComment. */
export function normalizePostComment(raw: unknown): ApiPostComment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o.id);
  if (!id) return null;
  return {
    id,
    post_id: pickStr(o.post_id) ?? "",
    user_id: pickStr(o.user_id) ?? "",
    content: typeof o.content === "string" ? o.content : String(o.content ?? ""),
    created_at: tsToIso(o.created_at),
    updated_at: tsToIso(o.updated_at),
    author_username: pickStr(o.author_username, o.username),
    author_display_name: pickStr(o.author_display_name, o.display_name),
    author_avatar_url: pickStr(o.author_avatar_url, o.avatar_url),
    username: pickStr(o.username, o.author_username),
    avatar_url: pickStr(o.avatar_url, o.author_avatar_url),
  };
}

export async function togglePostLike(postId: string) {
  const res = await apiClient.post<{
    message: string;
    is_liked: boolean;
    like_count: number;
  }>(`/api/v1/posts/${postId}/like`);
  return res.data;
}

export async function fetchPostComments(postId: string, limit = 50, offset = 0) {
  const res = await apiClient.get<{
    data?: unknown;
    limit: number;
    offset: number;
  }>(`/api/v1/posts/${postId}/comments`, { params: { limit, offset } });

  const raw = res.data?.data;
  const arr = Array.isArray(raw) ? raw : [];
  const out: ApiPostComment[] = [];
  for (const row of arr) {
    const c = normalizePostComment(row);
    if (c) out.push(c);
  }
  return out;
}

export async function createPostComment(postId: string, content: string) {
  const res = await apiClient.post<unknown>(`/api/v1/posts/${postId}/comments`, {
    content,
  });
  const c = normalizePostComment(res.data);
  if (!c) throw new Error("invalid comment response");
  return c;
}

export async function deletePostComment(postId: string, commentId: string) {
  await apiClient.delete(
    `/api/v1/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
  );
}
