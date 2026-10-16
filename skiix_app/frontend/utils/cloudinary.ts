// ============================================================
// CLOUDINARY URL OPTIMIZATION
// ============================================================
// Skiix stores most user-generated media on Cloudinary. We optimize image
// delivery by inserting an inline transformation (`w_…,q_auto,f_auto,c_fill`)
// before `/upload/` so the CDN can return a right-sized WebP/AVIF instead of
// the original full-resolution upload.
//
// Non-Cloudinary URLs (Unsplash, S3, ui-avatars, etc.) are returned unchanged.
// ============================================================

/** Pixel density to request from Cloudinary. 2 is enough for retina screens. */
const DENSITY = 2;

/** Snap to a small set of widths so the CDN cache stays warm. */
const SUPPORTED_WIDTHS = [120, 200, 320, 480, 640, 800, 1080, 1440];

function snapToSupportedWidth(width: number): number {
  for (const w of SUPPORTED_WIDTHS) {
    if (width <= w) return w;
  }
  return SUPPORTED_WIDTHS[SUPPORTED_WIDTHS.length - 1];
}

/**
 * Returns an optimized Cloudinary URL for the given display width (in px).
 * For non-Cloudinary URLs, returns the input unchanged.
 *
 * @example
 *   optimizeImageUrl("https://res.cloudinary.com/demo/image/upload/v1/avatar.png", 200)
 *   // → "https://res.cloudinary.com/demo/image/upload/w_400,q_auto,f_auto,c_fill/v1/avatar.png"
 */
export function optimizeImageUrl(url: string | null | undefined, displayWidth: number): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (!trimmed.includes("cloudinary.com") || !trimmed.includes("/upload/")) {
    return trimmed;
  }

  const target = snapToSupportedWidth(Math.max(1, Math.round(displayWidth * DENSITY)));
  const transform = `w_${target},q_auto,f_auto,c_fill/`;

  // If a transformation already exists (e.g. someone pre-cropped server side),
  // don't double up — skip optimization in that case.
  const uploadMarker = "/upload/";
  const idx = trimmed.indexOf(uploadMarker);
  if (idx === -1) return trimmed;
  const after = trimmed.slice(idx + uploadMarker.length);
  // A transformation is everything before the first version segment (`v123456/`)
  // or asset id. Cloudinary transformations always include `_` or `,` separators
  // before the next slash, so a quick heuristic is enough.
  const firstSlash = after.indexOf("/");
  if (firstSlash > 0) {
    const head = after.slice(0, firstSlash);
    if (head.includes(",") || head.startsWith("w_") || head.startsWith("h_") || head.startsWith("c_")) {
      return trimmed;
    }
  }

  return trimmed.slice(0, idx + uploadMarker.length) + transform + after;
}
