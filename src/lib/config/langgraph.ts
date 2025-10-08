/**
 * LangGraph Configuration
 *
 * Central configuration for LangGraph integration.
 * The React Agent uses the LangGraph SDK by default.
 * The Researcher workflow may use custom SSE for specific features.
 */

export type LangGraphConfigType = {
  // Feature flags
  useSDK: boolean; // Use LangGraph SDK (true) or custom SSE (false)
  enableAuth: boolean;

  // API configuration
  apiUrl: string;
  assistantId: string;

  // Stream configuration
  streamMode: readonly ("updates" | "messages" | "custom")[];

  // Authentication
  apiKey: string | null;
};

/**
 * Get LangGraph configuration from environment variables and runtime state
 */
export function getLangGraphConfig(): LangGraphConfigType {
  // Get API key from localStorage or environment
  let apiKey: string | null = null;
  if (typeof window !== "undefined") {
    apiKey = window.localStorage.getItem("langgraph-api-key") || null;
  }
  if (!apiKey) {
    apiKey = process.env.LANGGRAPH_API_KEY || null;
  }

  return {
    // Feature flags
    useSDK: process.env.NEXT_PUBLIC_USE_LANGGRAPH_SDK === "true",
    enableAuth: process.env.NEXT_PUBLIC_ENABLE_AUTH === "true",

    // API configuration
    apiUrl:
      process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024",
    assistantId: process.env.NEXT_PUBLIC_ASSISTANT_ID || "agent",

    // Stream configuration
    streamMode: ["updates", "messages", "custom"] as const,

    // Authentication
    apiKey,
  };
}

/**
 * Update configuration at runtime
 */
export function updateLangGraphConfig(
  updates: Partial<LangGraphConfigType>
): void {
  if (typeof window !== "undefined" && updates.apiKey !== undefined) {
    if (updates.apiKey) {
      window.localStorage.setItem("langgraph-api-key", updates.apiKey);
    } else {
      window.localStorage.removeItem("langgraph-api-key");
    }
  }
}

/**
 * Default configuration values
 */
export const DEFAULT_LANGGRAPH_CONFIG: Partial<LangGraphConfigType> = {
  useSDK: true, // Updated to use langgraph-sdk by default
  enableAuth: false,
  apiUrl: "http://localhost:2024",
  assistantId: "agent",
  streamMode: ["updates", "messages", "custom"] as const,
};
