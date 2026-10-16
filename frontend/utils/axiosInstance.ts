import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { ApiErrorDTO } from "@/types";
import { supabase } from "@/lib/supabase";

const getApiBaseUrl = (): string => {
  if (__DEV__) {
    const debuggerHost =
      Constants.expoConfig?.hostUri || Constants.experienceLoaderUri || "";
    const ip = debuggerHost.split(":")[0];
    return ip ? `http://${ip}:8080` : "http://localhost:8080";
  }
  return process.env.EXPO_PUBLIC_API_URL ?? "";
};

export const API_BASE_URL = getApiBaseUrl();
const REQUEST_TIMEOUT = 15_000;

if (__DEV__) {
  console.log("API Base URL:", API_BASE_URL);
  console.log("Platform:", Platform.OS);
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
  timeout: REQUEST_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-App-Version": "1.0.0",
    "X-Platform": "mobile",
  },
});

// Attach Supabase access token for protected Go API routes (when you add JWT verification for Supabase on the server).
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    if (__DEV__) {
      console.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorDTO>) => {
    if (__DEV__ && error.config) {
      console.error(
        `[API Error] ${error.response?.status} ${error.config.url}`,
        error.response?.data,
      );
    }
    return Promise.reject(error);
  },
);

// Legacy event for code that still listens; Supabase client handles sign-out.
export const authEventEmitter = {
  on(_e: string, _cb: () => void) {
    return () => {};
  },
  emit() {},
};

export default apiClient;
