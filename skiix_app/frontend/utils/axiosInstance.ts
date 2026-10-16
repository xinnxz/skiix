import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import { toast } from "sonner-native";
import { ApiErrorDTO } from "@/types";
import { supabase } from "@/lib/supabase";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export { getApiBaseUrl };
export const API_BASE_URL = getApiBaseUrl();

const NETWORK_TOAST_ID = "skiix-api-unreachable";
const REQUEST_TIMEOUT = 15_000;

if (__DEV__) {
  console.log("API Base URL:", getApiBaseUrl());
  console.log("Platform:", Platform.OS);
}

const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: false,
  timeout: REQUEST_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-App-Version": "1.0.0",
    "X-Platform": "mobile",
  },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Re-resolve each request so late Metro hostUri is picked up on device
    config.baseURL = getApiBaseUrl();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    if (__DEV__) {
      console.debug(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorDTO>) => {
    const base = error.config?.baseURL ?? getApiBaseUrl();
    const path = `${base}${error.config?.url ?? ""}`;

    if (!error.response) {
      toast.error(
        `Can't reach Skiix API at ${base}. Start backend (go run ./cmd/skiix) on same Wi‑Fi.`,
        { id: NETWORK_TOAST_ID, duration: 5000 },
      );
      if (__DEV__) {
        console.warn("[API]", error.code ?? "network", path, error.message);
      }
      return Promise.reject(error);
    }

    if (__DEV__) {
      console.warn(`[API] ${error.response.status} ${path}`, error.response.data);
    }
    return Promise.reject(error);
  },
);

export const authEventEmitter = {
  on(_e: string, _cb: () => void) {
    return () => {};
  },
  emit() {},
};

export default apiClient;
