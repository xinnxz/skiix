import { UserDTO, UserRole } from "@/types/user.types";

const defaultRole: UserRole = "founder";

/**
 * Map minimal /auth/profile response into UserDTO used by the app.
 */
export function mapProfileToUserDTO(p: {
  id: string;
  email: string;
  created_at: string;
}): UserDTO {
  const local = p.email?.split("@")[0] ?? "user";
  const username = local.replace(/[^a-zA-Z0-9_]/g, "") || "user";
  return {
    id: p.id,
    email: p.email,
    display_name: null,
    avatar_url: null,
    username: username.toLowerCase(),
    bio: null,
    role: defaultRole,
    investor_badge: null,
    startup: null,
    location: null,
    tagline: null,
    website_url: null,
    linkedin_url: null,
    twitter_handle: null,
    created_at: p.created_at,
  };
}
