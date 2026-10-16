import apiClient from "./axiosInstance";

export type UploadMediaResponse = {
  url: string;
  resource_type: "image" | "video" | "raw";
  public_id: string;
  bytes: number;
};

export const mediaApi = {
  async upload(file: { uri: string; name: string; type: string }) {
    const form = new FormData();
    // React Native FormData file shape
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    form.append("file", file);

    const res = await apiClient.post<UploadMediaResponse>("/api/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
};

