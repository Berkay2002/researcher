// URL constants
export const WWW_PREFIX_LENGTH = 4;
export const ROBOTS_TXT_PATH = "/robots.txt";

// Regex patterns for URL deduplication (defined at top level for performance)
const WWW_PREFIX_REGEX = /^www\./;
const TRACKING_PARAMS_REGEX = /^(utm_|gclid|fbclid|mc_cid|mc_eid)/i;

/**
 * Normalize URL for deduplication
 * - Remove trailing slashes
 * - Convert to lowercase
 * - Remove www prefix
 * - Sort query parameters
 * - Remove common tracking parameters
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove www prefix
    let hostname = parsed.hostname;
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(WWW_PREFIX_LENGTH);
    }

    // Sort query parameters and remove tracking params
    const trackingParams = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
    ]);

    const params = new URLSearchParams(parsed.search);
    const sortedParams = new URLSearchParams();

    for (const [key, value] of params) {
      if (!trackingParams.has(key)) {
        sortedParams.append(key, value);
      }
    }

    // Sort params alphabetically
    sortedParams.sort();

    // Remove trailing slash from pathname
    let pathname = parsed.pathname;
    if (pathname.endsWith("/") && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }

    // Reconstruct URL
    const normalized = `${parsed.protocol}//${hostname}${pathname}`;
    const query = sortedParams.toString();

    return query ? `${normalized}?${query}` : normalized;
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Create a dedupe key for URL that's protocol-agnostic and removes tracking params
 * Used for pre-fetch deduplication to avoid queueing the same page multiple times
 */
export function dedupeKeyForUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(WWW_PREFIX_REGEX, "").toLowerCase();
    let path = u.pathname;
    if (path.endsWith("/") && path.length > 1) {
      path = path.slice(0, -1);
    }

    const qs = new URLSearchParams(u.search);
    // remove tracking params, then sort
    const kept = new URLSearchParams();
    const entries = [...qs.entries()];
    for (const [k, v] of entries.filter(
      ([key]) => !TRACKING_PARAMS_REGEX.test(key)
    )) {
      kept.append(k, v);
    }

    // Sort params alphabetically
    const sortedParams = new URLSearchParams();
    const sortedEntries = [...kept.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [k, v] of sortedEntries) {
      sortedParams.append(k, v);
    }

    const q = sortedParams.toString();
    return `${host}${path}${q ? `?${q}` : ""}`; // note: no protocol
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Validate if string is a valid HTTP/HTTPS URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if URL is likely a robots.txt URL
 */
export function getRobotsTxtUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${ROBOTS_TXT_PATH}`;
  } catch {
    return null;
  }
}
