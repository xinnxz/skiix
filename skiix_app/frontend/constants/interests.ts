/**
 * Canonical interest tags used by Onboarding Step 3 and the Profile
 * Interests section. Values are stored on the backend exactly as-is
 * (without the leading `#`); the UI prefixes `#` when rendering.
 *
 * Keep this list in sync with `interests` on the `users` table.
 */
export const INTERESTS: string[] = [
  "web3",
  "fintech",
  "saas",
  "ai-ml",
  "design",
  "devtools",
  "growth",
  "ventures",
  "crypto",
  "mobile",
  "opensource",
  "productivity",
  "healthtech",
  "edtech",
  "ecommerce",
  "marketing",
  "no-code",
  "climate",
  "cybersecurity",
  "gaming",
];

export const INTERESTS_MIN_REQUIRED = 3;
export const INTERESTS_MAX_ALLOWED = 10;

export function formatInterestTag(value: string): string {
  return `#${value}`;
}
