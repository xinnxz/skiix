// ============================================================
// AUTH DTOs
// ============================================================

import { UserDTO } from "./user.types";

/** Token pair returned on successful auth */
export interface TokenPairDTO {
  /** Short-lived JWT access token (15 min TTL) */
  access_token: string;
  /** Long-lived refresh token (30 day TTL) */
  refresh_token: string;
  /** Access token expiry timestamp (Unix ms) */
  expires_at: number;
  /** Token type (always "Bearer") */
  token_type: "Bearer";
}

/** Response returned on login or register */
export interface AuthResponseDTO {
  user: UserDTO;
  tokens: TokenPairDTO;
}

/** Login request payload */
export interface LoginRequestDTO {
  /** Email or username */
  identifier: string;
  /** Raw password */
  password: string;
  /** Remember this device for refresh token lifetime */
  remember_me?: boolean;
}

/** Registration request payload */
export interface RegisterRequestDTO {
  /** Unique @username (3–30 chars, alphanumeric + underscores) */
  username: string;
  /** Full display name */
  // display_name: string;
  /** Valid email address */
  email: string;
  /** Password (min 8 chars, must include number + special char) */
  password: string;
  /** Confirm password (must match password) */
  // confirm_password: string;
  /** User role selection during onboarding */
  // role: "founder" | "investor" | "team_member" | "advisor";
  /** Whether user accepted terms of service */
  accepted_terms: boolean;
}

/** Refresh token request */
export interface RefreshTokenRequestDTO {
  refresh_token: string;
}

/** Forgot password request */
export interface ForgotPasswordRequestDTO {
  email: string;
}

/** Reset password request */
export interface ResetPasswordRequestDTO {
  /** OTP or token received via email */
  token: string;
  new_password: string;
  confirm_password: string;
}

/** OAuth provider login request */
export interface OAuthLoginRequestDTO {
  provider: "google" | "linkedin" | "apple";
  /** ID token from OAuth provider */
  id_token: string;
  /** Access token from OAuth provider */
  access_token?: string;
}

/** Stored auth state in SecureStore */
export interface StoredAuthState {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
}
