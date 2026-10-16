import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export type NetworkProjectRow = {
  id: string;
  title: string;
  description: string;
  logo_url: string;
  banner_url: string;
  category: string;
  owner_id: string;
  created_at: string;
  my_role: string;
  member_count: number;
};

export type NetworkProjectMemberRow = {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  role_tag: string;
  project_role: string;
  joined_at: string;
};

function authHeaders(token: string) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  } as const;
}

export async function fetchMyNetworkProjects(token: string): Promise<NetworkProjectRow[]> {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1/projects/my`, { headers: authHeaders(token) });
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: NetworkProjectRow[] };
  return Array.isArray(j.data) ? j.data : [];
}

export async function fetchNetworkProjectMembers(
  token: string,
  projectId: string,
): Promise<NetworkProjectMemberRow[]> {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1/projects/${encodeURIComponent(projectId)}/members`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: NetworkProjectMemberRow[] };
  return Array.isArray(j.data) ? j.data : [];
}
