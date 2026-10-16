import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

export type AuthUrlResult = { ok: true } | { ok: false; error: string };

/**
 * Finishes email confirmation / magic-link style redirects from Supabase.
 * Supports tokens in the URL hash, PKCE `?code=`, and already-persisted sessions.
 */
export async function completeAuthFromUrl(
  url: string | null | undefined,
): Promise<AuthUrlResult> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) {
    return { ok: true };
  }

  const target =
    url ??
    (Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.href
      : null);

  if (!target) {
    return {
      ok: false,
      error: "No recovery URL. Open the link again or sign in with email.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return { ok: false, error: "Invalid verification link." };
  }

  const hash = parsed.hash ? parsed.hash.replace(/^#/, "") : "";
  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const err = hashParams.get("error");
  const errDesc = hashParams.get("error_description");

  if (err) {
    return {
      ok: false,
      error: decodeURIComponent(errDesc || err).replace(/\+/g, " "),
    };
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      return {
        ok: false,
        error: mapSessionErrorMessage(error.message),
      };
    }
    return { ok: true };
  }

  const code = parsed.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, error: mapSessionErrorMessage(error.message) };
    }
    return { ok: true };
  }

  // Supabase "Confirm your signup" emails (link template) use token_hash + type.
  const tokenHash =
    parsed.searchParams.get("token_hash") ?? hashParams.get("token_hash");
  const otpType = (parsed.searchParams.get("type") ??
    hashParams.get("type") ??
    "email") as
    | "signup"
    | "email"
    | "recovery"
    | "invite"
    | "magiclink"
    | "email_change";

  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType === "signup" ? "signup" : "email",
    });
    if (error) {
      return { ok: false, error: mapSessionErrorMessage(error.message) };
    }
    if (data.session) return { ok: true };
  }

  return {
    ok: false,
    error:
      "This link is missing a session. It may be expired, already used, or opened on the wrong device. Try the code on the verify screen, or sign in again.",
  };
}

function mapSessionErrorMessage(msg: string) {
  if (/expired|invalid|revoked|jwt/i.test(msg)) {
    return "This link has expired. Request a new email from the app or use the 6-digit code.";
  }
  return msg;
}

/**
 * Strips the hash (tokens) from the URL after session is stored so a refresh does not re-process it.
 * No-op on native.
 */
export function stripAuthFromBrowserUrl() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const { pathname, search } = window.location;
  window.history.replaceState({}, document.title, `${pathname}${search}`);
}
