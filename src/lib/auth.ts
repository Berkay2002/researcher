/**
 * Authentication utilities for LangGraph integration
 *
 * Simplified authentication system for the react agent without
 * the complexity of Clerk or other auth providers.
 */

/**
 * Get API key from localStorage or environment
 */
export function getApiKey(): string | null {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem("langgraph-api-key") || null;
  }
  return process.env.LANGGRAPH_API_KEY || null;
}

/**
 * Set API key in localStorage
 */
export function setApiKey(key: string): void {
  if (typeof window !== "undefined") {
    if (key) {
      window.localStorage.setItem("langgraph-api-key", key);
    } else {
      window.localStorage.removeItem("langgraph-api-key");
    }
  }
}

/**
 * Check if API key is available
 */
export function hasApiKey(): boolean {
  return getApiKey() !== null;
}

const USER_ID_PREFIX = "user-";
const RANDOM_ID_LENGTH = 9;
const RADIX_BASE = 36;

/**
 * Get user ID (simplified version without auth)
 */
export function getUserId(): string {
  if (typeof window !== "undefined") {
    let userId = window.localStorage.getItem("langgraph-user-id");
    if (!userId) {
      // Generate a simple UUID-like ID
      userId = `${USER_ID_PREFIX}${Math.random()
        .toString(RADIX_BASE)
        .substring(2, 2 + RANDOM_ID_LENGTH)}`;
      window.localStorage.setItem("langgraph-user-id", userId);
    }
    return userId;
  }
  return "development-user";
}

/**
 * Clear all authentication data
 */
export function clearAuth(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("langgraph-api-key");
    window.localStorage.removeItem("langgraph-user-id");
  }
}

/**
 * Get user metadata for LangGraph requests
 */
export function getUserMetadata(): Record<string, string> {
  return {
    userAgent:
      typeof window !== "undefined" ? window.navigator.userAgent : "unknown",
    origin: typeof window !== "undefined" ? window.location.origin : "unknown",
  };
}
