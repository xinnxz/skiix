import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

/**
 * This app is Expo: Metro embeds EXPO_PUBLIC_* at build time.
 * NEXT_PUBLIC_* is supported as a fallback (e.g. shared docs with Next.js or copy-paste from Supabase).
 * Use only the anon key — never service_role in client code.
 */
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    "[Supabase] Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local (or NEXT_PUBLIC_* as fallback; see lib/supabase.ts).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // `app/auth/callback` + `completeAuthFromUrl` handle hash / PKCE; keep false to avoid double-parse.
    detectSessionInUrl: false,
  },
});
