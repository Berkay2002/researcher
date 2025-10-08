/**
 * LangGraph Client Utility
 *
 * Creates a configured LangGraph SDK client for interacting with
 * LangGraph servers and assistants.
 */

import { Client } from "@langchain/langgraph-sdk";

/**
 * Create a LangGraph client with the specified configuration
 */
export function createClient(apiUrl?: string, apiKey?: string): Client {
  // Default to the proxy route if no URL is provided
  const defaultApiUrl = "/api/langgraph";

  return new Client({
    apiUrl: apiUrl || defaultApiUrl,
    apiKey: apiKey || undefined,
  });
}

/**
 * Get a default client instance using configuration
 */
export function getDefaultClient(): Client {
  return createClient();
}

/**
 * Create a client with custom headers for additional metadata
 */
export function createClientWithHeaders(
  apiUrl?: string,
  apiKey?: string,
  headers?: Record<string, string>
): Client {
  // Default to the proxy route if no URL is provided
  const defaultApiUrl = "/api/langgraph";

  return new Client({
    apiUrl: apiUrl || defaultApiUrl,
    apiKey: apiKey || undefined,
    defaultHeaders: headers,
  });
}

/**
 * Check if the client can connect to the LangGraph server
 */
export async function checkConnection(
  apiUrl?: string,
  apiKey?: string
): Promise<boolean> {
  try {
    const client = createClient(apiUrl, apiKey);
    const response = await client.assistants.search({ limit: 1 });
    return Array.isArray(response);
  } catch {
    // Silently handle connection errors
    return false;
  }
}
