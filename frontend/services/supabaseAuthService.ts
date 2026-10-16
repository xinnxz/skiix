import * as WebBrowser from "expo-web-browser";
import type { Session, User } from "@supabase/supabase-js";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";
import { mapProfileToUserDTO } from "@/utils/userProfileMapper";
import { UserDTO } from "@/types/user.types";

/** Match profile form: 3–32, letters, numbers, underscore. */
const USERNAME_IN_METADATA = /^[a-zA-Z0-9_]{3,32}$/;

export function isMissingProfilesTableMessage(msg: string): boolean {
  return /could not find the table|schema cache|does not exist/i.test(msg);
}

/**
 * `getSession()` can lag behind `updateUser` — merge `getUser()` for fresh `user_metadata`.
 */
export async function getSessionForRefresh(): Promise<Session | null> {
  const { data: s } = await supabase.auth.getSession();
  const session = s.session;
  if (!session) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return session;
  return { ...session, user: data.user };
}

function tryUserMetadataProfile(
  user: User,
  email: string,
): { user: UserDTO; hasProfile: true } | null {
  const m = user.user_metadata as Record<string, unknown> | null | undefined;
  const u = typeof m?.username === "string" ? m.username : "";
  if (!USERNAME_IN_METADATA.test(u)) return null;
  const first =
    typeof m?.first_name === "string" ? m.first_name.trim() : "";
  const last = typeof m?.last_name === "string" ? m.last_name.trim() : "";
  const displayNameFromParts = `${first} ${last}`.trim();
  const displayName =
    (typeof m?.display_name === "string" && m.display_name.trim()) ||
    displayNameFromParts ||
    null;
  const avatarUrl =
    typeof m?.avatar_url === "string" && m.avatar_url.trim()
      ? m.avatar_url.trim()
      : null;
  const location =
    typeof m?.location === "string" && m.location.trim() ? m.location.trim() : null;
  const tagline =
    typeof m?.tagline === "string" && m.tagline.trim() ? m.tagline.trim() : null;
  return {
    hasProfile: true,
    user: {
      id: user.id,
      email,
      display_name: displayName,
      avatar_url: avatarUrl,
      username: u.toLowerCase(),
      bio: typeof m.bio === "string" ? m.bio : null,
      role: "founder",
      investor_badge: null,
      startup: null,
      location,
      tagline,
      website_url: null,
      linkedin_url: null,
      twitter_handle: null,
      created_at: user.created_at,
    },
  };
}

export function isOnboardingComplete(user: User): boolean {
  const m = user.user_metadata as Record<string, unknown> | null | undefined;
  return m?.onboarding_complete === true;
}

export type ProfileRow = {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Sign up with email + password.
 * If you want "no OTP / no email confirm", disable Confirm Email in Supabase Dashboard.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  metadata?: {
    username?: string;
    display_name?: string;
    role?: string;
    first_name?: string;
    last_name?: string;
  },
) {
  const emailRedirectTo = getAuthRedirectUrl();
  return supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      emailRedirectTo,
      data: metadata
        ? {
            username: metadata.username,
            display_name: metadata.display_name,
            role: metadata.role,
            first_name: metadata.first_name,
            last_name: metadata.last_name,
          }
        : undefined,
    },
  });
}

/**
 * (Optional) Verify confirmation codes.
 * Not used when "Confirm email" is disabled.
 */
export async function verifyEmailConfirmationOtp(email: string, token: string) {
  const clean = token.replace(/\D/g, "");
  const e = normalizeEmail(email);
  const first = await supabase.auth.verifyOtp({
    email: e,
    token: clean,
    type: "signup",
  });
  if (!first.error) return first;
  return supabase.auth.verifyOtp({
    email: e,
    token: clean,
    type: "email",
  });
}

/**
 * Resend the signup / confirmation code.
 */
export async function resendSignupEmail(email: string) {
  const emailRedirectTo = getAuthRedirectUrl();
  return supabase.auth.resend({
    type: "signup",
    email: normalizeEmail(email),
    options: { emailRedirectTo },
  });
}

/**
 * Google OAuth: opens in-app browser; session arrives via onAuthStateChange.
 */
export async function signInWithGoogle() {
  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { data: null, error };
  if (!data?.url) return { data: null, error: new Error("No OAuth URL") };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    showInRecents: false,
  });
  if (result.type === "dismiss" || result.type === "cancel") {
    return { data: null, error: new Error("Sign in cancelled") };
  }
  if (result.type === "success" && "url" in result && result.url) {
    const fragment = new URL(result.url).hash.replace(/^#/, "");
    if (fragment) {
      const params = Object.fromEntries(new URLSearchParams(fragment)) as {
        access_token?: string;
        refresh_token?: string;
      };
      if (params.access_token && params.refresh_token) {
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (sessErr) return { data: null, error: sessErr };
      }
    } else {
      const { error: sessErr } = await supabase.auth.getSession();
      if (sessErr) return { data: null, error: sessErr };
    }
  }
  return { data: { ok: true }, error: null };
}

export async function signOut() {
  return supabase.auth.signOut();
}

/**
 * Auth `user_metadata` (no `profiles` table required) first, else `public.profiles`.
 */
export async function loadProfileForUser(
  user: User,
): Promise<{ user: UserDTO; hasProfile: boolean; onboardingComplete: boolean }> {
  const email = user.email ?? "";
  const onboardingComplete = isOnboardingComplete(user);
  const fromMeta = tryUserMetadataProfile(user, email);
  if (fromMeta) return { ...fromMeta, onboardingComplete };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, bio, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    const m = String(error.message ?? "");
    if (isMissingProfilesTableMessage(m)) {
      return {
        hasProfile: false,
        onboardingComplete,
        user: mapProfileToUserDTO({
          id: user.id,
          email,
          created_at: user.created_at ?? new Date().toISOString(),
        }),
      };
    }
    if (
      error.code === "PGRST116" ||
      m.includes("relation") ||
      m.includes("permission") ||
      m.includes("RLS") ||
      m.includes("policy") ||
      m.includes("JWT")
    ) {
      return {
        hasProfile: false,
        onboardingComplete,
        user: mapProfileToUserDTO({
          id: user.id,
          email,
          created_at: user.created_at ?? new Date().toISOString(),
        }),
      };
    }
    throw error;
  }

  if (!data?.username) {
    return {
      hasProfile: false,
      onboardingComplete,
      user: mapProfileToUserDTO({
        id: user.id,
        email,
        created_at: user.created_at ?? new Date().toISOString(),
      }),
    };
  }

  return {
    hasProfile: true,
    onboardingComplete,
    user: {
      id: data.id,
      email,
      display_name: null,
      avatar_url: data.avatar_url,
      username: data.username!,
      bio: data.bio,
      role: "founder",
      investor_badge: null,
      startup: null,
      location: null,
      tagline: null,
      website_url: null,
      linkedin_url: null,
      twitter_handle: null,
      created_at: data.created_at,
    },
  };
}

export async function upsertProfile(p: {
  userId: string;
  username: string;
  bio: string;
  avatar_url: string | null;
}) {
  return supabase.from("profiles").upsert(
    {
      id: p.userId,
      username: p.username,
      bio: p.bio,
      avatar_url: p.avatar_url,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}
