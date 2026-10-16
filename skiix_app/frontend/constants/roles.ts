/**
 * Signup / profile / onboarding role tags (persisted as `role_tag`).
 * Icons are Ionicons glyph names.
 */
import { Ionicons } from "@expo/vector-icons";

export type RoleId = "founder" | "investor" | "team" | "advisor";

export type RoleIconName = keyof typeof Ionicons.glyphMap;

export type RoleDef = {
  id: RoleId;
  label: string;
  subtitle: string;
  icon: RoleIconName;
};

export const ROLES: RoleDef[] = [
  {
    id: "founder",
    label: "Founder",
    subtitle: "Building a startup",
    icon: "rocket-outline",
  },
  {
    id: "investor",
    label: "Investor",
    subtitle: "Backing founders",
    icon: "cash-outline",
  },
  {
    id: "team",
    label: "Team",
    subtitle: "Joining a startup",
    icon: "people-outline",
  },
  {
    id: "advisor",
    label: "Advisor",
    subtitle: "Mentor & guide",
    icon: "sparkles-outline",
  },
];

const KNOWN: Record<string, RoleId> = {
  founder: "founder",
  investor: "investor",
  team: "team",
  advisor: "advisor",
  team_member: "team",
};

export function normalizeRoleId(
  raw: string | null | undefined,
): RoleId | null {
  if (!raw) return null;
  const t = String(raw).trim().toLowerCase();
  return KNOWN[t] ?? null;
}

export function roleById(raw: string | null | undefined): RoleDef | null {
  const id = normalizeRoleId(raw);
  if (!id) return null;
  return ROLES.find((r) => r.id === id) ?? null;
}

export function roleLabel(raw: string | null | undefined): string {
  return roleById(raw)?.label ?? "";
}

export function getRoleIcon(raw: string): RoleIconName {
  return roleById(raw)?.icon ?? "person-outline";
}

export function getRoleLabel(raw: string): string {
  return roleLabel(raw) || "Select role";
}

export function isValidRoleTag(raw: string | null | undefined): boolean {
  return normalizeRoleId(raw) !== null;
}
