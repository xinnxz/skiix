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

  const meta = m as Record<string, unknown> | undefined;
  const strOrNull = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const websiteUrl = strOrNull(meta?.website ?? meta?.website_url);
  const linkedinUrl = strOrNull(meta?.linkedin ?? meta?.linkedin_url);
  const twitterHandle = strOrNull(meta?.twitter ?? meta?.twitter_handle);
  const githubHandle = strOrNull(meta?.github ?? meta?.github_handle);
  const roleTag = strOrNull(meta?.role_tag);
  const prefs = (meta?.preferences as Record<string, unknown> | undefined) ?? {};
  const interestsRaw =
    (Array.isArray(meta?.interests) && meta?.interests) ||
    (Array.isArray(prefs.interests) && prefs.interests) ||
    [];
  const interests = (interestsRaw as unknown[]).filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  const skillsRaw = Array.isArray(meta?.skills) ? meta?.skills : [];
  const skills = (skillsRaw as unknown[]).filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  const onboardingCompleted = meta?.onboarding_complete === true;

  return {
    hasProfile: true,
    user: {
      id: user.id,
      email,
      display_name: displayName,
      avatar_url: avatarUrl,
      username: u.toLowerCase(),
      bio: typeof m?.bio === "string" ? (m.bio as string) : null,
      role: "founder",
      investor_badge: null,
      startup: null,
      location,
      tagline,
      website_url: websiteUrl,
      linkedin_url: linkedinUrl,
      twitter_handle: twitterHandle,
      github_handle: githubHandle,
      role_tag: roleTag,
      interests,
      skills,
      onboarding_completed: onboardingCompleted,
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

/** Map Supabase Auth errors to user-facing signup/login messages. */
export function formatSupabaseAuthError(e: unknown): string {
  const err = e as { message?: string; msg?: string; code?: string };
  const m = String(err?.message ?? err?.msg ?? e ?? "").trim();
  const code = String(err?.code ?? "");

  if (
    /error sending confirmation email|unexpected_failure/i.test(m) ||
    code === "unexpected_failure"
  ) {
    return "We could not send the verification email. In Supabase Dashboard → Authentication → Email: enable confirmations and use the built-in sender (Custom SMTP off).";
  }
  if (
    m.includes("User already registered") ||
    m.includes("already been registered") ||
    m.includes("already registered")
  ) {
    return "This email is already registered. Sign in instead.";
  }
  if (/rate limit|email rate limit/i.test(m)) {
    return "Too many attempts. Please wait a few minutes.";
  }
  if (/invalid email|unable to validate email/i.test(m)) {
    return "Please enter a valid email address.";
  }
  if (/password/i.test(m) && m.length < 120) {
    return m;
  }
  if (m) return m;
  return "Something went wrong. Please try again.";
}

/**
 * Sign up with email + password.
 *
 * Signup with magic link + OTP: pass `emailRedirectTo` (e.g. `skiix://auth/callback`)
 * and use a Confirm signup template with `{{ .ConfirmationURL }}` and `{{ .Token }}`.
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
  const normalized = normalizeEmail(email);
  const fullName = (metadata?.display_name ?? "").trim();
  const username =
    (metadata?.username ?? normalized.split("@")[0] ?? "user")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, "_")
      .slice(0, 32) || "user";

  const redirectTo = getAuthRedirectUrl();
  return supabase.auth.signUp({
    email: normalized,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        full_name: fullName,
        username,
        ...(metadata?.role ? { signup_role: metadata.role } : {}),
      },
    },
  });
}

export function isEmailNotConfirmedError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? "");
  const code = String((e as { code?: string })?.code ?? "");
  return (
    /email not confirmed|email_not_confirmed|confirm your email|not been confirmed/i.test(
      msg,
    ) || code === "email_not_confirmed"
  );
}

/**
 * (Optional) Verify confirmation codes.
 * Not used when "Confirm email" is disabled.
 */
export async function verifyEmailConfirmationOtp(email: string, token: string) {
  const otp = token.replace(/\D/g, "");
  return supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: otp,
    type: "signup",
  });
}

/** Resend signup confirmation (magic link + OTP code in template). */
export async function resendSignupEmail(
  email: string,
  emailRedirectTo?: string,
) {
  return supabase.auth.resend({
    type: "signup",
    email: normalizeEmail(email),
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
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
