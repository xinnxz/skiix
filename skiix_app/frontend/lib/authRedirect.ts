import { Platform } from "react-native";
import Constants from "expo-constants";
import { makeRedirectUri } from "expo-auth-session";

const CALLBACK_PATH = "auth/callback";

/**
 * Optional full redirect URL (highest priority).
 * Example for Expo Go on a physical device:
 *   exp://192.168.18.83:8081/--/auth/callback
 * Production dev build:
 *   skiix://auth/callback
 */
function envRedirectOverride(): string | null {
  const full = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  if (full) return full;
  return null;
}

/** Derive LAN host from EXPO_PUBLIC_API_URL (same machine as Metro). */
function lanHostFromApiUrl(): string | null {
  const api = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!api) return null;
  try {
    const u = new URL(api);
    const host = u.hostname;
    if (!host || host === "localhost" || host === "127.0.0.1") return null;
    return host;
  } catch {
    return null;
  }
}

/** Expo manifest host, e.g. `192.168.18.83:8081`. */
function lanHostFromExpo(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri?.trim() ||
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri?.trim();
  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

/**
 * Build `exp://<LAN>:8081/--/auth/callback` for Expo Go on a real device.
 * `localhost` in email links points at the phone itself → ERR_CONNECTION_REFUSED.
 */
function expoGoCallbackUrl(): string | null {
  const host = lanHostFromApiUrl() ?? lanHostFromExpo();
  if (!host) return null;
  return `exp://${host}:8081/--/${CALLBACK_PATH}`;
}

/**
 * OAuth `redirectTo` only (Google sign-in). Do NOT use for email signup OTP —
 * `signUp` / `resend` must omit `emailRedirectTo` (see supabaseAuthService).
 *
 * Register this URL in Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export function getAuthRedirectUrl(): string {
  const override = envRedirectOverride();
  if (override) return override;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const originOverride = process.env.EXPO_PUBLIC_AUTH_REDIRECT_ORIGIN?.trim();
    if (originOverride) {
      return `${originOverride.replace(/\/$/, "")}/${CALLBACK_PATH}`;
    }
    return `${window.location.origin}/${CALLBACK_PATH}`;
  }

  // Native: prefer explicit Expo Go LAN URL, then makeRedirectUri (no localhost).
  const expoGo = expoGoCallbackUrl();
  if (expoGo) return expoGo;

  const fromExpo = makeRedirectUri({
    path: CALLBACK_PATH,
    scheme: "skiix",
    preferLocalhost: false,
  });
  if (
    fromExpo &&
    !fromExpo.includes("localhost") &&
    !fromExpo.includes("127.0.0.1")
  ) {
    return fromExpo;
  }

  // Last resort — custom scheme (standalone / dev client).
  return makeRedirectUri({ path: CALLBACK_PATH, scheme: "skiix" });
}

/** Logged in dev so you can paste into Supabase Redirect URLs. */
export function logAuthRedirectHint(): void {
  if (!__DEV__) return;
  const url = getAuthRedirectUrl();
  console.log(
    "[Auth] Add this to Supabase → Authentication → URL Configuration → Redirect URLs:\n",
    url,
  );
}
