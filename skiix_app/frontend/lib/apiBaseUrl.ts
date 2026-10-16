import Constants from "expo-constants";
import { Platform } from "react-native";

/** Collect Metro / dev-server host from every Expo Constants source available. */
function metroHost(): string {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.experienceLoaderUri,
    // @ts-expect-error legacy manifest fields still present in some Expo Go builds
    Constants.manifest?.debuggerHost,
    // @ts-expect-error manifest2 debugger host
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
    Constants.linkingUri,
  ];

  for (const raw of candidates) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    // exp://192.168.x.x:8081/--/... or 192.168.x.x:8081
    const withoutScheme = s.replace(/^[a-z]+:\/\//i, "");
    const hostPort = withoutScheme.split("/")[0] ?? "";
    const ip = hostPort.split(":")[0]?.trim();
    if (
      ip &&
      ip !== "localhost" &&
      ip !== "127.0.0.1" &&
      !ip.startsWith("127.")
    ) {
      return ip;
    }
  }
  return "";
}

let cached: { host: string; url: string } | null = null;

/**
 * Resolve Go API base URL at request time (not module load).
 * Physical Android devices cannot use localhost — must use PC LAN IP.
 */
export function getApiBaseUrl(): string {
  const host = metroHost();
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim()?.replace(/\/$/, "");

  if (cached && cached.host === host && (host || fromEnv)) {
    return cached.url;
  }

  let url = "";

  if (__DEV__) {
    if (host) {
      url = `http://${host}:8080`;
      if (fromEnv) {
        try {
          const envHost = new URL(fromEnv).hostname;
          if (envHost !== host) {
            console.warn(
              `[API] EXPO_PUBLIC_API_URL (${fromEnv}) ≠ Metro (${host}). Using ${url}`,
            );
          }
        } catch {
          /* use live host */
        }
      }
    } else if (fromEnv) {
      url = fromEnv;
    } else if (Platform.OS === "android" && !Constants.isDevice) {
      // Android emulator → host machine
      url = "http://10.0.2.2:8080";
    } else if (Platform.OS === "ios" && !Constants.isDevice) {
      url = "http://localhost:8080";
    } else {
      console.warn(
        "[API] Could not detect Metro LAN IP. Set EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:8080 in frontend/.env.local",
      );
      url = "http://localhost:8080";
    }
  } else if (fromEnv) {
    url = fromEnv;
  }

  cached = { host, url };
  return url;
}

/** @deprecated Use getApiBaseUrl() — kept for imports that read a string once. */
export const API_BASE_URL = getApiBaseUrl();
