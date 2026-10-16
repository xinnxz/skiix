import { Platform } from "react-native";
import { makeRedirectUri } from "expo-auth-session";

const CALLBACK_PATH = "auth/callback";

/**
 * Public URL passed to Supabase as `emailRedirectTo` and OAuth `redirectTo`.
 *
 * - **Expo Go / dev:** `exp://<LAN-IP>:8081/--/auth/callback` — reachable from a phone on the
 *   same Wi‑Fi (not `localhost`, which would point at the device itself → ERR_CONNECTION_REFUSED).
 * - **Dev build / store build:** `skiix://auth/callback` (scheme from `app.json`).
 * - **Web:** `window.location.origin` + path, or `EXPO_PUBLIC_AUTH_REDIRECT_ORIGIN` when the app is
 *   opened from another host (e.g. `http://192.168.1.5:8081`).
 *
 * Add every URL this returns in your environment to Supabase:
 * Dashboard → Authentication → URL Configuration → **Redirect URLs** (and avoid Site URL = localhost:3000 for mobile tests).
 */
export function getAuthRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const originOverride = process.env.EXPO_PUBLIC_AUTH_REDIRECT_ORIGIN?.trim();
    if (originOverride) {
      return `${originOverride.replace(/\/$/, "")}/${CALLBACK_PATH}`;
    }
    return `${window.location.origin}/${CALLBACK_PATH}`;
  }
  // Native: do not pass `scheme` — Expo Go uses `exp://…`; production uses app scheme from app.json.
  return makeRedirectUri({ path: CALLBACK_PATH });
}