import axiosInstance, {
  clearAllAuthData,
  getAccesToken,
  getUserData,
  storeAccessToken,
  storeUserData,
} from "@/utils/axiosInstance";
import { getApiErrorMessage } from "@/utils/getApiErrorMessage";

// Types based on Swagger documentation
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string; // Returns "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

export interface RegisterRequest {
  email: string;
  password: string; // minimum 6 characters
}

export interface AuthResponse {
  message: string; // "User registered successfully"
}

export interface ProfileResponse {
  id: string;
  email: string;
  provider: string; // "local" for email/password users
  created_at: string;
  updated_at: string;
}

export interface ErrorResponse {
  error: string;
}

export const authService = {
  /**
   * Login with email and password
   * POST /auth/login
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    try {
      console.log("login data:", data);
      const response = await axiosInstance.post<LoginResponse>(
        "/auth/login",
        data,
      );
      console.log("Response: ", response);
      let token = response.data.token;
      if (token.startsWith("Bearer ")) {
        token = token.substring(7);
      }
      storeAccessToken(token);
      await this.fetchAndStoreProfile();
      return { token };
    } catch (error: any) {
      throw new Error(getApiErrorMessage(error));
    }
  },

  async googleLogin(): Promise<LoginResponse> {
    try {
      const response = await axiosInstance.get<LoginResponse>("/auth/google");
      let token = response.data.token;
      if (token.startsWith("Bearer ")) {
        token = token.substring(7);
      }
      storeAccessToken(token);

      await this.fetchAndStoreProfile();
      console.log("googleLogin response:", response.data);

      return { token };
    } catch (error: any) {
      // throw this.handleError(error);
      throw getApiErrorMessage(error);
    }
  },

  /**
   * Register a new user
   * POST /auth/register
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await axiosInstance.post<AuthResponse>(
        "/auth/register",
        data,
      );
      await this.login(data);
      return response.data;
    } catch (error: any) {
      // throw this.handleError(error);
      throw getApiErrorMessage(error);
    }
  },

  /**
   * Get user profile
   * GET /auth/profile
   */
  async getProfile(): Promise<ProfileResponse> {
    try {
      const response =
        await axiosInstance.get<ProfileResponse>("/auth/profile");
      return response.data;
    } catch (error: any) {
      // throw this.handleError(error);
      throw getApiErrorMessage(error);
    }
  },

  /**
   * Fetch and store user profile in AsyncStorage
   */
  async fetchAndStoreProfile(): Promise<ProfileResponse> {
    const profile = await this.getProfile();
    await storeUserData(profile);
    return profile;
  },

  /**
   * Logout user
   * POST /auth/logout
   */
  async logout(): Promise<void> {
    try {
      const token = await getAccesToken();
      if (token) {
        await axiosInstance.post(
          "/auth/logout",
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      }
    } catch (error: any) {
      console.error("Logout axiosInstance error:", error);
    } finally {
      await clearAllAuthData();
    }
  },

  /**
   * Get stored user profile
   */
  async getStoredUser(): Promise<ProfileResponse | null> {
    const userData = await getUserData();
    return userData ? JSON.parse(userData) : null;
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await getAccesToken();
    return !!token;
  },

  /**
   * Handle API errors
   */
  handleError(error: any): Error {
    if (error.response) {
      const data = error.response.data;

      const message =
        data?.error ||
        data?.message ||
        `Request failed with status ${error.response.status}`;

      return new Error(message);
    }

    if (error.request) {
      return new Error("No response from server. Check your network.");
    }

    return new Error(error.message || "Unexpected error occurred");
  },
};
