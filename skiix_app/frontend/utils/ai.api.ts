import axios from "axios";
import apiClient from "@/utils/axiosInstance";

export type AIAssistAction = "improve" | "expand" | "shorten" | "hashtags";

export async function assistPost(
  text: string,
  action: AIAssistAction,
): Promise<{ result: string; action: string }> {
  try {
    const res = await apiClient.post<{ data: { result: string; action: string } }>(
      "/api/v1/ai/assist-post",
      { text: text.trim(), action },
      { timeout: 45_000 },
    );
    const data = res.data?.data;
    if (!data?.result) {
      throw new Error("No response from AI");
    }
    return data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const errBody = e.response?.data as { error?: string } | undefined;
      const msg = errBody?.error?.trim();
      throw new Error(msg || "AI service unavailable. Try again.");
    }
    throw e;
  }
}
