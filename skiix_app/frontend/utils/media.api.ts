import apiClient from "./axiosInstance";
import { getApiErrorMessage } from "./getApiErrorMessage";

export type UploadMediaResponse = {
  url: string;
  resource_type: "image" | "video" | "raw";
  public_id: string;
  bytes: number;
};

const UPLOAD_TIMEOUT_MS = 180_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1200;

function isVideoMime(type: string) {
  return type.startsWith("video/");
}

function isRetryableUploadError(error: unknown): boolean {
  const msg = getApiErrorMessage(error).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("unreachable") ||
    msg.includes("server error") ||
    msg.includes("cloudinary")
  );
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export const mediaApi = {
  async upload(
    file: { uri: string; name: string; type: string },
    onProgress?: (pct: number) => void,
  ): Promise<UploadMediaResponse> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (__DEV__) {
          console.log(`[Upload] attempt ${attempt}/${MAX_RETRIES}`, file.name, file.type);
        }
        onProgress?.(Math.min(10 + attempt * 5, 30));

        const form = new FormData();
        // React Native FormData file shape
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        form.append("file", file);

        const res = await apiClient.post<UploadMediaResponse>("/api/v1/upload", form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: isVideoMime(file.type) ? UPLOAD_TIMEOUT_MS : 60_000,
        });

        const data = res.data;
        if (!data?.url) {
          throw new Error("Upload succeeded but no URL was returned.");
        }

        if (__DEV__) {
          console.log("[Upload] success", {
            public_id: data.public_id,
            resource_type: data.resource_type,
            bytes: data.bytes,
          });
        }
        onProgress?.(100);
        return data;
      } catch (error) {
        lastError = error;
        if (__DEV__) {
          console.warn(`[Upload] attempt ${attempt} failed`, getApiErrorMessage(error));
        }
        if (attempt < MAX_RETRIES && isRetryableUploadError(error)) {
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
        break;
      }
    }

    const msg = getApiErrorMessage(lastError);
    throw new Error(msg.startsWith("Upload") ? msg : `Upload failed: ${msg}`);
  },
};
