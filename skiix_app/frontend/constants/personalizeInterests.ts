/** Shared definitions for personalize grid + optional profile hashtags. */

export type PersonalizeInterest = {
  id: string;
  label: string;
  icon: string;
  library: "MaterialCommunityIcons" | "Ionicons" | "Feather";
};

export const PERSONALIZE_INTERESTS: PersonalizeInterest[] = [
  { id: "ai", label: "AI / ML", icon: "robot-outline", library: "MaterialCommunityIcons" },
  { id: "saas", label: "SaaS", icon: "cloud-outline", library: "Ionicons" },
  { id: "design", label: "Design", icon: "brush-outline", library: "Ionicons" },
  {
    id: "web3",
    label: "Web3",
    icon: "database-outline",
    library: "MaterialCommunityIcons",
  },
  { id: "growth", label: "Growth", icon: "trending-up", library: "Feather" },
  {
    id: "fintech",
    label: "FinTech",
    icon: "currency-usd",
    library: "MaterialCommunityIcons",
  },
  {
    id: "devtools",
    label: "DevTools",
    icon: "code-braces",
    library: "MaterialCommunityIcons",
  },
  {
    id: "ventures",
    label: "Ventures",
    icon: "rocket-launch-outline",
    library: "MaterialCommunityIcons",
  },
];

export function interestLabel(id: string) {
  return PERSONALIZE_INTERESTS.find((i) => i.id === id)?.label ?? id;
}
