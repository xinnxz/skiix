// ============================================================
// PROFILE / ONBOARDING API SERVICE
//
// Talks to the Go backend (the new /api/v1/users/* routes). Identity is
// resolved from `user_id` + `email` because the React Native app carries
// Supabase JWTs, not Go-backend JWTs — same pattern as follow_handler.
// ============================================================

import apiClient from "./axiosInstance";
import { supabase } from "@/lib/supabase";

const V = "/api/v1";

export type BackendProfile = {
  id: string;
  email?: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  location: string;
  website: string;
  twitter: string;
  linkedin: string;
  github: string;
  role_tag: string;
  interests: string[];
  skills: string[];
  is_verified: boolean;
  onboarding_completed: boolean;
  created_at?: string;
  updated_at?: string;
};

export type UserStats = {
  posts_count: number;
  followers_count: number;
  following_count: number;
  projects_count: number;
};

export type OnboardingPayload = {
  role_tag: string;
  interests: string[];
  skills: string[];
  onboarding_completed?: boolean;
};

export type ProfileUpdate = Partial<{
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  location: string;
  website: string;
  twitter: string;
  linkedin: string;
  github: string;
  role_tag: string;
  interests: string[];
  skills: string[];
}>;

async function currentIdentity(): Promise<{ user_id: string; email: string }> {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u?.email) throw new Error("Not signed in");
  return { user_id: u.id, email: u.email };
}

export const profileApi = {
  async getMe(): Promise<BackendProfile> {
    const id = await currentIdentity();
    const res = await apiClient.get<BackendProfile>(`${V}/users/me`, {
      params: id,
    });
    return res.data;
  },

  async getByUsername(username: string): Promise<BackendProfile> {
    const res = await apiClient.get<BackendProfile>(
      `${V}/users/${encodeURIComponent(username)}`,
    );
    return res.data;
  },

  async getStats(username: string): Promise<UserStats> {
    try {
      const res = await apiClient.get<UserStats>(
        `${V}/users/${encodeURIComponent(username)}/stats`,
      );
      return res.data;
    } catch {
      return {
        posts_count: 0,
        followers_count: 0,
        following_count: 0,
        projects_count: 0,
      };
    }
  },

  async checkUsernameAvailable(
    username: string,
    exceptUserId?: string,
  ): Promise<boolean> {
    const res = await apiClient.get<{ available: boolean }>(
      `${V}/users/username/available`,
      { params: { username, except_user_id: exceptUserId } },
    );
    return !!res.data?.available;
  },

  async updateMe(patch: ProfileUpdate): Promise<BackendProfile> {
    const id = await currentIdentity();
    const res = await apiClient.put<BackendProfile>(`${V}/users/me`, {
      ...id,
      ...patch,
    });
    return res.data;
  },

  async completeOnboarding(payload: OnboardingPayload): Promise<BackendProfile> {
    const id = await currentIdentity();
    const res = await apiClient.put<BackendProfile>(`${V}/users/me/onboarding`, {
      ...id,
      onboarding_completed: true,
      ...payload,
    });
    return res.data;
  },

  /** After Supabase OTP verify — requires `SUPABASE_JWT_SECRET` on the Go server. */
  async createProfileAfterSignup(body: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    role_tag?: string;
    onboarding_completed: boolean;
  }): Promise<BackendProfile | undefined> {
    try {
      const res = await apiClient.post<{ data: BackendProfile }>(
        `${V}/users/create-profile`,
        {
          ...body,
          role_tag: body.role_tag ?? body.role,
        },
      );
      return res.data?.data;
    } catch {
      return undefined;
    }
  },
};
