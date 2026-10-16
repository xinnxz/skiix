/** True when the string looks like an email, not a display name or handle. */
export function looksLikeEmail(s: string): boolean {
  const t = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/** Strip @ and email-shaped values to a local-part handle. */
export function cleanHandle(raw: string): string {
  let s = raw.trim().replace(/^@/, "");
  if (!s) return "";
  if (looksLikeEmail(s)) {
    const local = s.split("@")[0]?.trim() ?? "";
    return local.replace(/[^a-z0-9_]/gi, "").toLowerCase();
  }
  return s.replace(/[^a-z0-9_]/gi, "").toLowerCase();
}

/** Bold line: full name when distinct from handle, otherwise handle. */
export function displayFullName(fullName: string, username: string): string {
  const fn = fullName.trim();
  const un = cleanHandle(username);
  if (fn && !looksLikeEmail(fn) && fn.toLowerCase() !== un) return fn;
  if (un) return un;
  if (fn && !looksLikeEmail(fn)) return fn;
  return "Member";
}
