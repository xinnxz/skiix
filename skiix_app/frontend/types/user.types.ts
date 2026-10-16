// ============================================================
// USER DTOs
// ============================================================

/** Role of the user on the platform */
export type UserRole = "founder" | "investor" | "team_member" | "team" | "advisor";

/** Startup stage */
export type StartupStage =
  | "idea"
  | "pre_seed"
  | "seed"
  | "series_a"
  | "series_b"
  | "growth"
  | "public";

/** User entity returned from API */
export interface UserDTO {
  /** Unique user identifier (UUID) */
  id: string;
  /** Email (when returned from /auth/profile) */
  email?: string;
  /** Full name (from Supabase user_metadata or backend profiles) */
  display_name?: string | null;
  /** Profile photo URL (from Supabase user_metadata or backend profiles) */
  avatar_url?: string | null;
  /** Display username (unique, @handle) */
  username: string;
  /** Short bio / headline */
  bio: string | null;
  /** User role on the platform */
  role?: UserRole;
  /** Verified badge (investor-verified or founder-verified) */
  // is_verified: boolean;
  /** Investor badge: shown when role = investor */
  investor_badge: InvestorBadgeDTO | null;
  /** Startup affiliation (for founders/team) */
  startup: StartupSummaryDTO | null;
  /** User's location string */
  location: string | null;
  /** Short headline / tagline (e.g. "Verified Startup Founder & Product Strategist") */
  tagline: string | null;
  /** External website URL */
  website_url: string | null;
  /** LinkedIn URL */
  linkedin_url: string | null;
  /** Twitter/X handle */
  twitter_handle: string | null;
  /** GitHub handle (no `@` prefix) */
  github_handle?: string | null;
  /** Role tag id (founder, developer, etc.) */
  role_tag?: string | null;
  /** Predefined interest ids selected during onboarding/personalize */
  interests?: string[];
  /** Predefined skill labels chosen during onboarding */
  skills?: string[];
  /** Whether the onboarding flow has been completed */
  onboarding_completed?: boolean;
  /** Number of followers */
  // follower_count: number;
  /** Number of accounts this user follows */
  // following_count: number;
  /** Number of posts */
  // post_count: number;
  /** Number of reels */
  // reel_count: number;
  /** Whether the requesting user follows this user */
  // is_following: boolean;
  /** Whether this user follows the requesting user back */
  // follows_you: boolean;
  /** Account creation timestamp (ISO 8601) */
  created_at: string;
  /** Last profile update timestamp */
  // updated_at: string;
}

/** Minimal user summary used in nested references (e.g. post author) */
export interface UserSummaryDTO {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  is_verified: boolean;
  investor_badge: InvestorBadgeDTO | null;
}

/** Investor badge details */
export interface InvestorBadgeDTO {
  /** Firm / fund name */
  firm_name: string;
  /** Total portfolio companies count */
  portfolio_count: number;
  /** Badge tier: angel, micro_vc, vc, corporate_vc */
  tier: "angel" | "micro_vc" | "vc" | "corporate_vc";
  /** AUM label (e.g. "$10M–$50M") */
  aum_label: string | null;
}

/** Startup summary embedded in user profile */
export interface StartupSummaryDTO {
  id: string;
  name: string;
  logo_url: string | null;
  stage: StartupStage;
  tagline: string | null;
  industry: string;
}

// ============================================================
// REQUEST DTOs
// ============================================================

/** Request body for updating user profile */
export interface UpdateProfileRequestDTO {
  display_name?: string;
  bio?: string;
  location?: string;
  website_url?: string;
  linkedin_url?: string;
  twitter_handle?: string;
  github_handle?: string;
  role_tag?: string;
  role?: UserRole;
  interests?: string[];
  skills?: string[];
}
