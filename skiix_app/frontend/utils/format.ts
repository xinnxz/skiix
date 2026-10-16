// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format a number into compact human-readable form
 * e.g. 1234 → "1.2K", 1500000 → "1.5M"
 */
export function formatCount(count: number): string {
  if (count === 0) return "0";
  if (count < 1000) return count.toString();
  if (count < 1_000_000)
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/**
 * Format an ISO timestamp into a relative time string
 * e.g. "2m", "3h", "yesterday", "Apr 12"
 */
export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const date = new Date(isoString).getTime();
  const diff = Math.floor((now - date) / 1000); // seconds

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return "yesterday";

  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a full date
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

/**
 * Extract hashtags from text
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_]+/g) ?? [];
  return matches.map((m) => m.slice(1));
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Generate initials from a display name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Format duration in seconds to mm:ss
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
