import type { Session } from "@supabase/supabase-js";
import type { Router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { normalizeRoleId } from "@/constants/roles";
import { setOnboardingStep } from "@/utils/onboardingProgress";

export type SignupMeta = {
  email: string;
  fullName?: string;
  username?: string;
  roleTag?: string;
};

export function signupMetaFromSession(session: Session): SignupMeta {
  const email = (session.user.email ?? "").trim().toLowerCase();
  const m = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = String(m.full_name ?? "").trim();
  const username = String(m.username ?? "").trim().toLowerCase();
  const roleRaw = String(m.signup_role ?? m.role_tag ?? "").trim();
  const roleTag = normalizeRoleId(roleRaw) ?? "founder";
  const baseUsername = email.split("@")[0].replace(/[^a-z0-9]/g, "").slice(0, 15);
  const fallbackUsername = `${baseUsername}${Math.floor(Math.random() * 999)}`;
  return {
    email,
    fullName,
    username: username || fallbackUsername,
    roleTag,
  };
}

/** Creates Go backend user row after Supabase email is confirmed (idempotent). */
export async function createUserProfileIfNeeded(
  session: Session,
  overrides?: Partial<SignupMeta>,
): Promise<void> {
  const baseUrl = getApiBaseUrl().replace(
    /\/$/,
    "",
  );
  if (!baseUrl || !session.access_token) return;

  const meta = { ...signupMetaFromSession(session), ...overrides };

  try {
    const checkRes = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (checkRes.ok) return;
  } catch {
    /* proceed to create */
  }

  try {
    await fetch(`${baseUrl}/api/v1/users/create-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        id: session.user.id,
        email: meta.email,
        full_name: meta.fullName ?? "",
        username: meta.username,
        role_tag: meta.roleTag ?? "founder",
        role: meta.roleTag ?? "founder",
        onboarding_completed: false,
      }),
    });
  } catch (e) {
    if (__DEV__) console.warn("[CreateProfile]", e);
  }
}

export function isEmailConfirmed(session: Session | null | undefined): boolean {
  if (!session?.user) return false;
  if (session.user.email_confirmed_at) return true;
  const at = (session.user as { confirmed_at?: string | null }).confirmed_at;
  return Boolean(at);
}

export async function refreshSessionAndCheckConfirmed(): Promise<Session | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    const { data: cur } = await supabase.auth.getSession();
    const s = cur.session;
    return s && isEmailConfirmed(s) ? s : null;
  }
  const s = data.session;
  return s && isEmailConfirmed(s) ? s : null;
}

/** Writes username / name into Supabase Auth so stage gate sees a valid profile. */
export async function syncSignupMetadataToSupabase(
  session: Session,
  meta: SignupMeta,
): Promise<void> {
  const prev = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const username = (meta.username ?? "").trim().toLowerCase();
  if (!username || username.length < 3) return;
  try {
    await supabase.auth.updateUser({
      data: {
        ...prev,
        username,
        full_name: meta.fullName ?? prev.full_name ?? "",
        signup_role: meta.roleTag ?? prev.signup_role ?? "",
        onboarding_complete: false,
      },
    });
  } catch (e) {
    if (__DEV__) console.warn("[syncSignupMetadata]", e);
  }
}

export async function finishEmailVerificationFlow(
  router: Router,
  opts?: Partial<SignupMeta>,
): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  if (!session || !isEmailConfirmed(session)) {
    session = await refreshSessionAndCheckConfirmed();
  }
  if (!session || !isEmailConfirmed(session)) return false;

  const meta = { ...signupMetaFromSession(session), ...opts };
  await createUserProfileIfNeeded(session, meta);
  await syncSignupMetadataToSupabase(session, meta);
  await setOnboardingStep(1);

  const { navigateAfterAuth } = await import("@/lib/navigateAfterAuth");
  await navigateAfterAuth(router);
  return true;
}
