import { Client } from "@langchain/langgraph-sdk";

let clientInstance: Client | null = null;

/**
 * Get singleton LangGraph SDK client instance
 *
 * Connects to LangGraph Server for React agent operations.
 * Configuration via environment variables:
 * - LANGGRAPH_API_URL: Server URL (default: http://localhost:2024)
 * - LANGGRAPH_API_KEY: Optional API key for authentication
 *
 * @returns Singleton Client instance
 */
export function getLangGraphClient(): Client {
  if (!clientInstance) {
    const apiUrl =
      process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ||
      process.env.LANGGRAPH_API_URL ||
      "http://localhost:2024";
    const apiKey =
      process.env.NEXT_PUBLIC_LANGGRAPH_API_KEY ||
      process.env.LANGGRAPH_API_KEY;

    clientInstance = new Client({
      apiUrl,
      apiKey: apiKey || undefined,
    });
  }

  return clientInstance;
}

/**
 * Reset the singleton client instance (useful for testing)
 */
export function resetLangGraphClient(): void {
  clientInstance = null;
}
