import { AxiosError, isAxiosError } from "axios";

type ApiErrorResponse =
  | { message?: string; error?: string }
  | string
  | null
  | undefined;

export function getApiErrorMessage(error: unknown): string {
  // AXIOS ERROR
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;

    // Server responded (backend error)
    if (axiosError.response) {
      const data = axiosError.response.data;

      // backend returned plain string
      if (typeof data === "string" && data.trim().length > 0) {
        return data;
      }

      // backend returned object
      if (data && typeof data === "object") {
        if (data.error && typeof data.error === "string") {
          return data.error;
        }

        if (data.message && typeof data.message === "string") {
          return data.message;
        }
      }

      // fallback to status-based message
      switch (axiosError.response.status) {
        case 400:
          return "Invalid request. Please check your input.";
        case 401:
          return "Invalid credentials.";
        case 403:
          return "You are not allowed to perform this action.";
        case 404:
          return "Resource not found.";
        case 409:
          return "Conflict occurred.";
        case 500:
          return "Server error. Please try again later.";
        default:
          return `Request failed (${axiosError.response.status})`;
      }
    }

    // No response (network issues)
    if (axiosError.request) {
      if (axiosError.code === "ECONNABORTED") {
        return "Request timeout. Please try again.";
      }

      return "No internet connection or server unreachable.";
    }
  }

  // Non-axios error
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
