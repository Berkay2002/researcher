/**
 * Favicon Utility Functions
 *
 * Shared utilities for working with domain favicons across components
 */

/**
 * Get favicon URL for a domain using Google's favicon service
 *
 * @param domain - Domain name (e.g., "example.com")
 * @param size - Icon size (default: 64px for hi-DPI displays)
 * @returns URL to the favicon
 */
export function getFaviconUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

/**
 * Generate consistent color gradient class from domain name
 *
 * Uses hash function to deterministically select from predefined color palette.
 * Same domain will always get the same color.
 *
 * @param domain - Domain name
 * @returns Tailwind gradient class string (e.g., "from-green-400 to-green-600")
 */
export function getDomainColor(domain: string): string {
  const colors = [
    "from-green-400 to-green-600",
    "from-blue-400 to-blue-600",
    "from-purple-400 to-purple-600",
    "from-pink-400 to-pink-600",
    "from-orange-400 to-orange-600",
    "from-teal-400 to-teal-600",
    "from-cyan-400 to-cyan-600",
    "from-indigo-400 to-indigo-600",
  ];

  // Constants for hash calculation
  const HASH_PRIME = 31;
  const MAX_HASH_VALUE = 2_147_483_647; // Maximum 32-bit signed integer

  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    const char = domain.charCodeAt(i);
    hash = ((hash * HASH_PRIME) + char) % MAX_HASH_VALUE;
  }

  return colors[Math.abs(hash) % colors.length];
}
